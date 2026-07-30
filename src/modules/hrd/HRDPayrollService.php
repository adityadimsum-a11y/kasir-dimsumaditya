<?php
declare(strict_types=1);

namespace ERP\Modules\HRD;

use DateTimeImmutable;
use ERP\Core\ApiException;
use ERP\Core\ArchiveService;
use ERP\Core\AuditService;
use ERP\Core\Database;
use ERP\Core\IdGenerator;
use ERP\Core\TransactionManager;
use PDO;
use Throwable;

/**
 * Part 5A — HRD / Payroll V32 Data & Ledger Migration.
 *
 * Scope package ini:
 * - Master karyawan PHP/MySQL.
 * - Import aman backup JSON Payroll V32/V23 localStorage.
 * - Riwayat kasbon, pinjaman, payroll draft/closed sebagai histori terkunci.
 * - Absensi/izin live dan input kasbon/pinjaman baru dengan Wallet OUT + jurnal.
 * - Cabang hanya melihat/menginput data lokasi sendiri; nominal gaji dimask untuk cabang.
 *
 * Payroll closing, reopen, payment, dan print final tetap Part 5B.
 */
final class HRDPayrollService
{
    private $pdo;
    private $ids;
    private $audit;
    private $archive;
    private $transactions;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
        $this->ids = new IdGenerator($this->pdo);
        $this->audit = new AuditService($this->pdo);
        $this->archive = new ArchiveService($this->pdo);
        $this->transactions = new TransactionManager($this->pdo);
    }

    public function health(): array
    {
        $migrationApplied = (int)$this->pdo->query(
            "SELECT COUNT(*) FROM schema_migrations
             WHERE migration_id = '021_phase_5a_hrd_payroll_v32_data_ledger'"
        )->fetchColumn() === 1;

        $requiredTables = [
            'hrd_payroll_import_batches',
            'hrd_employees',
            'hrd_employee_salary_history',
            'hrd_employee_status_history',
            'hrd_employee_advances',
            'hrd_employee_loans',
            'hrd_employee_loan_movements',
            'hrd_attendance_entries',
            'hrd_payroll_runs',
        ];
        $missing = [];
        foreach ($requiredTables as $table) {
            if (!$this->tableExists($table)) {
                $missing[] = $table;
            }
        }

        $latestImport = null;
        if ($missing === [] && $this->tableExists('hrd_payroll_import_batches')) {
            $latestImport = $this->pdo->query(
                'SELECT import_batch_id, source_app, source_version, source_exported_at,
                        active_period, employee_count, payroll_closed_count,
                        payroll_draft_count, advance_entry_count, loan_movement_count,
                        status, imported_at
                 FROM hrd_payroll_import_batches
                 ORDER BY imported_at DESC
                 LIMIT 1'
            )->fetch() ?: null;
        }

        return [
            'ready' => $migrationApplied && $missing === [],
            'migration_021_applied' => $migrationApplied,
            'tables_ready' => $missing === [],
            'missing_tables' => $missing,
            'latest_import' => $latestImport,
            'single_source' => 'PHP/MySQL',
            'legacy_import_creates_cash_effect' => false,
            'server_calculation_required_for_part_5b' => true,
            'print_template_benchmark' => 'Dimsum Aditya Payroll V32',
        ];
    }

    public function bootstrap(array $user, array $payload, array $scope): array
    {
        $this->assertReady();
        $isGlobal = $this->isGlobalScope($scope);
        $ownLocationId = $this->scopeLocationId($scope);
        $period = $this->periodOrDefault((string)($payload['period'] ?? ''), date('Y-m'));
        $locationFilter = trim((string)($payload['location_id'] ?? ''));
        $selectedLocationId = null;

        if (!$isGlobal) {
            $selectedLocationId = $ownLocationId;
        } elseif ($locationFilter !== '' && strtoupper($locationFilter) !== 'ALL') {
            $selectedLocationId = (string)$this->activeLocationByAny($locationFilter)['location_id'];
        }

        $fullPayrollAccess = $this->fullPayrollAccess($user, $scope);
        $employees = $this->employeeRows($selectedLocationId, $fullPayrollAccess);
        $employeeIds = array_column($employees, 'employee_id');

        $advances = $this->advanceRows($employeeIds, $period);
        $loans = $this->loanRows($employeeIds);
        $attendance = $this->attendanceRows($employeeIds, $period);
        $payrollRuns = $fullPayrollAccess
            ? $this->payrollRows($selectedLocationId, $period)
            : [];

        $advanceBalances = $this->advanceBalances($employeeIds);
        $loanBalances = $this->loanBalances($employeeIds);
        foreach ($employees as &$employee) {
            $employeeId = (string)$employee['employee_id'];
            $employee['advance_balance'] = (float)($advanceBalances[$employeeId] ?? 0);
            $employee['loan_balance'] = (float)($loanBalances[$employeeId] ?? 0);
            if (!$fullPayrollAccess) {
                $employee['base_salary'] = null;
                $employee['daily_salary'] = null;
                $employee['fixed_allowance'] = null;
                $employee['salary_masked'] = true;
            } else {
                $employee['salary_masked'] = false;
            }
        }
        unset($employee);

        $summary = $this->summary($employees, $advanceBalances, $loanBalances, $payrollRuns, $period);

        return [
            'health' => $this->health(),
            'summary' => $summary,
            'period' => $period,
            'employees' => $employees,
            'attendance_rows' => $attendance,
            'kasbon_rows' => $advances,
            'loan_rows' => $loans,
            'payroll_recaps' => $payrollRuns,
            'payroll_drafts' => array_values(array_filter($payrollRuns, static function (array $row): bool { return strtoupper((string)$row['status']) === 'DRAFT'; })),
            'payroll_payments' => [],
            'wallets' => $this->walletRows($selectedLocationId, $isGlobal),
            'locations' => $this->activeLocations(),
            'import_batches' => $fullPayrollAccess ? $this->importBatchRows() : [],
            'access' => [
                'is_global' => $isGlobal,
                'own_location_id' => $ownLocationId,
                'full_payroll_access' => $fullPayrollAccess,
                'can_import_v32' => $fullPayrollAccess,
                'can_manage_employee' => $fullPayrollAccess,
                'can_input_attendance' => true,
                'can_input_advance' => true,
                'can_input_loan' => true,
                'can_close_payroll' => false,
                'part_5b_required' => true,
            ],
            'source_of_truth' => [
                'employee' => 'hrd_employees + hrd_employee_salary_history',
                'attendance' => 'hrd_attendance_entries',
                'advance' => 'hrd_employee_advances',
                'loan' => 'hrd_employee_loans + hrd_employee_loan_movements',
                'payroll_history' => 'hrd_payroll_runs',
                'import_audit' => 'hrd_payroll_import_batches + archive_transactions + audit_trail',
            ],
        ];
    }

    public function previewV32Import(array $payload): array
    {
        $this->assertReady();
        $backup = $this->backupPayload($payload);
        $normalized = $this->normalizeBackup($backup);
        $checksum = hash('sha256', $this->encodeJson($backup));
        $existing = $this->findImportByChecksum($checksum);

        return [
            'ready_to_import' => $existing === null && $normalized['errors'] === [],
            'already_imported' => $existing !== null,
            'existing_import' => $existing,
            'checksum_sha256' => $checksum,
            'source' => $normalized['source'],
            'summary' => $normalized['summary'],
            'locations' => $normalized['locations'],
            'warnings' => $normalized['warnings'],
            'errors' => $normalized['errors'],
            'accounting_policy' => [
                'legacy_wallet_mutation_created' => false,
                'legacy_journal_created' => false,
                'reason' => 'Histori lokal tidak boleh membuat kas lama keluar lagi saat migrasi.',
            ],
            'confirmation_phrase' => 'IMPORT PAYROLL V32',
        ];
    }

    public function importV32Backup(array $user, array $payload, string $operationId): array
    {
        return $this->transactions->run(function () use ($user, $payload, $operationId): array {
            $this->assertReady();
            $confirmation = strtoupper(trim((string)($payload['confirmation'] ?? '')));
            if ($confirmation !== 'IMPORT PAYROLL V32') {
                throw new ApiException(
                    'Ketik IMPORT PAYROLL V32 untuk mengunci migrasi data Payroll.',
                    422,
                    'HRD_IMPORT_CONFIRMATION_REQUIRED'
                );
            }

            $backup = $this->backupPayload($payload);
            $normalized = $this->normalizeBackup($backup);
            if ($normalized['errors'] !== []) {
                throw new ApiException(
                    'Backup Payroll tidak lolos validasi.',
                    422,
                    'HRD_IMPORT_BACKUP_INVALID',
                    ['errors' => $normalized['errors']]
                );
            }

            $checksum = hash('sha256', $this->encodeJson($backup));
            $existing = $this->findImportByChecksum($checksum, true);
            if ($existing !== null) {
                return [
                    'message' => 'Backup yang sama sudah pernah di-import. Tidak ada data yang digandakan.',
                    'data' => [
                        'idempotent_replay' => true,
                        'import_batch' => $existing,
                        'summary' => $normalized['summary'],
                    ],
                ];
            }

            $date = new DateTimeImmutable('now');
            $importBatchId = $this->ids->next('HRDIMP', 'TGR', $date);
            $employeeMap = [];
            $inserted = [
                'employees' => 0,
                'salary_history' => 0,
                'status_history' => 0,
                'advances' => 0,
                'loans' => 0,
                'loan_movements' => 0,
                'payroll_runs' => 0,
            ];

            foreach ($normalized['employees'] as $employeeData) {
                $employee = $this->upsertImportedEmployee(
                    $user,
                    $employeeData,
                    $importBatchId,
                    $operationId,
                    $inserted
                );
                $employeeMap[$employeeData['source_key']] = $employee;
            }

            foreach ($normalized['employees'] as $employeeData) {
                $employee = $employeeMap[$employeeData['source_key']];
                $this->importAdvanceRows($user, $employee, $employeeData, $importBatchId, $operationId, $inserted);
                $this->importLoanRows($user, $employee, $employeeData, $importBatchId, $operationId, $inserted);
            }

            foreach ($normalized['payroll_runs'] as $payrollData) {
                $sourceKey = $payrollData['employee_source_key'];
                if (!isset($employeeMap[$sourceKey])) {
                    throw new ApiException(
                        'Payroll memiliki nama karyawan yang tidak ditemukan pada master backup: ' . $sourceKey,
                        422,
                        'HRD_IMPORT_PAYROLL_EMPLOYEE_MISSING'
                    );
                }
                $this->importPayrollRun(
                    $user,
                    $employeeMap[$sourceKey],
                    $payrollData,
                    $importBatchId,
                    $operationId,
                    $inserted
                );
            }

            $source = $normalized['source'];
            $summary = $normalized['summary'];
            $batchStmt = $this->pdo->prepare(
                'INSERT INTO hrd_payroll_import_batches (
                    import_batch_id, source_app, source_version, source_exported_at,
                    active_period, checksum_sha256, file_name,
                    employee_count, payroll_closed_count, payroll_draft_count,
                    advance_entry_count, loan_movement_count,
                    summary_json, status, operation_id, imported_by, imported_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
            );
            $batchStmt->execute([
                $importBatchId,
                $source['app'],
                $source['version'],
                $source['exported_at_mysql'],
                $source['active_period'],
                $checksum,
                $this->text((string)($payload['file_name'] ?? 'Backup Payroll V32.json'), 255),
                $summary['employee_count'],
                $summary['payroll_closed_count'],
                $summary['payroll_draft_count'],
                $summary['advance_entry_count'],
                $summary['loan_movement_count'],
                $this->encodeJson([
                    'source' => $source,
                    'summary' => $summary,
                    'locations' => $normalized['locations'],
                    'warnings' => $normalized['warnings'],
                    'inserted' => $inserted,
                ]),
                'IMPORTED',
                $operationId,
                $user['user_id'] ?? null,
            ]);

            $archiveId = $this->archive->register($user, [
                'transaction_id' => $importBatchId,
                'module' => 'HRD_PAYROLL',
                'transaction_type' => 'V32_IMPORT_BATCH',
                'location_id' => $user['location_id'] ?? 'LOC-TGR-001',
                'transaction_date' => date('Y-m-d'),
                'title' => 'Import Payroll V32 — ' . $source['active_period'],
                'summary' => $summary['employee_count'] . ' karyawan · '
                    . $summary['payroll_closed_count'] . ' payroll closing · '
                    . $summary['payroll_draft_count'] . ' draft',
                'status' => 'IMPORTED',
                'source_table' => 'hrd_payroll_import_batches',
                'source_key' => $importBatchId,
                'snapshot' => [
                    'checksum_sha256' => $checksum,
                    'source' => $source,
                    'summary' => $summary,
                    'inserted' => $inserted,
                    'legacy_cash_effect_created' => false,
                ],
            ], $operationId);

            $auditId = $this->audit->record(
                $user,
                'HRD_PAYROLL',
                'IMPORT_V32_BACKUP',
                $importBatchId,
                null,
                [
                    'checksum_sha256' => $checksum,
                    'summary' => $summary,
                    'inserted' => $inserted,
                ],
                'Backup Payroll lokal dimigrasikan ke PHP/MySQL',
                'Tidak membuat mutasi dompet atau jurnal kas historis baru.',
                $operationId
            );

            return [
                'message' => 'Backup Payroll V32 berhasil dimigrasikan tanpa menggandakan uang lama.',
                'data' => [
                    'import_batch_id' => $importBatchId,
                    'archive_id' => $archiveId,
                    'audit_id' => $auditId,
                    'checksum_sha256' => $checksum,
                    'summary' => $summary,
                    'inserted' => $inserted,
                    'legacy_wallet_mutations_created' => 0,
                    'legacy_accounting_journals_created' => 0,
                ],
            ];
        });
    }

    public function createEmployee(array $user, array $payload, string $operationId): array
    {
        return $this->transactions->run(function () use ($user, $payload, $operationId): array {
            $this->assertReady();
            $location = $this->activeLocationByAny((string)($payload['location_id'] ?? ''));
            $name = $this->requiredText((string)($payload['employee_name'] ?? ''), 150, 'Nama karyawan');
            $date = new DateTimeImmutable('now');
            $employeeId = $this->ids->next('EMP', (string)$location['location_code'], $date);
            $employeeCode = $this->employeeCode($employeeId, $name);
            $status = $this->employmentStatus((string)($payload['employment_status'] ?? 'ACTIVE'));
            $salaryMode = $this->salaryMode((string)($payload['salary_mode'] ?? 'BULANAN'));
            $baseSalary = $this->money($payload['base_salary'] ?? 0);
            $fixedAllowance = $this->money($payload['fixed_allowance'] ?? $payload['job_allowance'] ?? 0);
            $payrollDay = $this->payrollDay($payload['payroll_day'] ?? 28);

            $stmt = $this->pdo->prepare(
                'INSERT INTO hrd_employees (
                    employee_id, employee_code, employee_name, normalized_name,
                    location_id, location_code, location_name_snapshot,
                    position_name, payroll_day, salary_mode, pay_cycle,
                    base_salary, daily_salary, default_work_days, fixed_allowance,
                    employment_status, source_system, source_key, source_snapshot_json,
                    status, operation_id, created_by, created_at, updated_by, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())'
            );
            $stmt->execute([
                $employeeId,
                $employeeCode,
                $name,
                $this->normalizeName($name),
                $location['location_id'],
                $location['location_code'],
                $location['location_name'],
                $this->nullableText((string)($payload['position_name'] ?? $payload['position'] ?? ''), 100),
                $payrollDay,
                $salaryMode,
                strtoupper(trim((string)($payload['pay_cycle'] ?? 'BULANAN'))) ?: 'BULANAN',
                $baseSalary,
                $this->money($payload['daily_salary'] ?? 0),
                $this->decimal($payload['default_work_days'] ?? 0),
                $fixedAllowance,
                $status,
                'ERP_LIVE',
                $employeeId,
                $this->encodeJson($payload),
                'ACTIVE',
                $operationId,
                $user['user_id'] ?? null,
                $user['user_id'] ?? null,
            ]);

            $salaryHistoryId = $this->ids->next('SALHIST', (string)$location['location_code'], $date);
            $salaryStmt = $this->pdo->prepare(
                'INSERT INTO hrd_employee_salary_history (
                    salary_history_id, employee_id, effective_period, salary_mode,
                    base_salary, daily_salary, default_work_days, fixed_allowance,
                    source_type, source_id, notes, operation_id, created_by, created_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
            );
            $salaryStmt->execute([
                $salaryHistoryId,
                $employeeId,
                $this->periodOrDefault((string)($payload['effective_period'] ?? ''), date('Y-m')),
                $salaryMode,
                $baseSalary,
                $this->money($payload['daily_salary'] ?? 0),
                $this->decimal($payload['default_work_days'] ?? 0),
                $fixedAllowance,
                'MASTER_CREATE',
                $employeeId,
                $this->nullableText((string)($payload['notes'] ?? ''), 500),
                $operationId,
                $user['user_id'] ?? null,
            ]);

            $archiveId = $this->archive->register($user, [
                'transaction_id' => $employeeId,
                'module' => 'HRD',
                'transaction_type' => 'EMPLOYEE_MASTER',
                'location_id' => $location['location_id'],
                'transaction_date' => date('Y-m-d'),
                'title' => 'Karyawan — ' . $name,
                'summary' => $location['location_name'] . ' · ' . ($payload['position_name'] ?? '-'),
                'status' => $status,
                'source_table' => 'hrd_employees',
                'source_key' => $employeeId,
                'snapshot' => [
                    'employee_id' => $employeeId,
                    'employee_name' => $name,
                    'location' => $location,
                    'payroll_day' => $payrollDay,
                    'salary_mode' => $salaryMode,
                ],
            ], $operationId);

            $auditId = $this->audit->record(
                $user,
                'HRD',
                'CREATE_EMPLOYEE',
                $employeeId,
                null,
                ['employee_name' => $name, 'location_id' => $location['location_id'], 'employment_status' => $status],
                'Master karyawan dibuat',
                (string)($payload['notes'] ?? ''),
                $operationId
            );

            return [
                'message' => 'Karyawan berhasil dibuat di PHP/MySQL.',
                'data' => [
                    'employee_id' => $employeeId,
                    'salary_history_id' => $salaryHistoryId,
                    'archive_id' => $archiveId,
                    'audit_id' => $auditId,
                ],
            ];
        });
    }

    public function createAttendance(array $user, array $payload, array $scope, string $operationId): array
    {
        return $this->transactions->run(function () use ($user, $payload, $scope, $operationId): array {
            $employee = $this->employeeById((string)($payload['employee_id'] ?? ''), true);
            $this->assertEmployeeScope($employee, $scope);
            $dateValue = $this->dateOrDefault((string)($payload['attendance_date'] ?? ''), date('Y-m-d'));
            $attendanceType = $this->attendanceType((string)($payload['attendance_type'] ?? 'HADIR'));
            $deductSalary = (bool)($payload['deduct_salary'] ?? in_array($attendanceType, ['TIDAK_MASUK'], true));
            $dayFraction = max(0.0, min(1.0, $this->decimal($payload['day_fraction'] ?? 1)));
            $id = $this->ids->next('ABS', (string)$employee['location_code'], new DateTimeImmutable($dateValue));

            $existing = $this->pdo->prepare(
                'SELECT attendance_id FROM hrd_attendance_entries
                 WHERE employee_id = ? AND attendance_date = ? FOR UPDATE'
            );
            $existing->execute([$employee['employee_id'], $dateValue]);
            $existingId = $existing->fetchColumn();
            if ($existingId !== false) {
                throw new ApiException('Absensi tanggal tersebut sudah tercatat.', 409, 'HRD_ATTENDANCE_DUPLICATE');
            }

            $stmt = $this->pdo->prepare(
                'INSERT INTO hrd_attendance_entries (
                    attendance_id, employee_id, location_id, attendance_date,
                    attendance_type, day_fraction, deduct_salary, overtime_amount,
                    notes, status, operation_id, created_by, created_at, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())'
            );
            $stmt->execute([
                $id,
                $employee['employee_id'],
                $employee['location_id'],
                $dateValue,
                $attendanceType,
                $dayFraction,
                $deductSalary ? 1 : 0,
                $this->money($payload['overtime_amount'] ?? 0),
                $this->nullableText((string)($payload['notes'] ?? ''), 1000),
                'ACTIVE',
                $operationId,
                $user['user_id'] ?? null,
            ]);

            $auditId = $this->audit->record(
                $user,
                'HRD_ATTENDANCE',
                'CREATE',
                $id,
                null,
                [
                    'employee_id' => $employee['employee_id'],
                    'attendance_date' => $dateValue,
                    'attendance_type' => $attendanceType,
                    'deduct_salary' => $deductSalary,
                ],
                'Absensi/izin karyawan dicatat',
                (string)($payload['notes'] ?? ''),
                $operationId
            );

            return [
                'message' => 'Absensi/izin berhasil dicatat.',
                'data' => ['attendance_id' => $id, 'audit_id' => $auditId],
            ];
        });
    }

    public function createAdvance(array $user, array $payload, array $scope, string $operationId): array
    {
        return $this->transactions->run(function () use ($user, $payload, $scope, $operationId): array {
            $employee = $this->employeeById((string)($payload['employee_id'] ?? ''), true);
            $this->assertEmployeeScope($employee, $scope);
            $wallet = $this->walletById((string)($payload['wallet_id'] ?? ''), true);
            if (!hash_equals((string)$wallet['location_id'], (string)$employee['location_id'])) {
                throw new ApiException('Dompet kasbon harus berasal dari lokasi karyawan.', 422, 'HRD_ADVANCE_WALLET_LOCATION_MISMATCH');
            }
            $amount = $this->positiveMoney($payload['amount'] ?? 0, 'Nominal kasbon');
            if ((float)$wallet['current_balance'] + 0.0001 < $amount) {
                throw new ApiException('Saldo dompet tidak cukup untuk kasbon ini.', 409, 'HRD_ADVANCE_WALLET_INSUFFICIENT', [
                    'wallet_id' => $wallet['wallet_id'],
                    'current_balance' => (float)$wallet['current_balance'],
                    'requested_amount' => $amount,
                ]);
            }
            $dateValue = $this->dateOrDefault((string)($payload['date'] ?? $payload['entry_date'] ?? ''), date('Y-m-d'));
            $date = new DateTimeImmutable($dateValue);
            $advanceId = $this->ids->next('KASBON', (string)$employee['location_code'], $date);
            $mutationId = $this->ids->next('WM', (string)$employee['location_code'], $date);
            $journalId = $this->ids->next('JRN', (string)$employee['location_code'], $date);

            $stmt = $this->pdo->prepare(
                'INSERT INTO hrd_employee_advances (
                    advance_entry_id, employee_id, location_id, entry_date,
                    entry_type, amount, balance_effect, locked, notes,
                    accounting_json, source_system, source_key, status,
                    operation_id, created_by, created_at, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())'
            );
            $stmt->execute([
                $advanceId,
                $employee['employee_id'],
                $employee['location_id'],
                $dateValue,
                'TAKE',
                $amount,
                $amount,
                $this->nullableText((string)($payload['notes'] ?? ''), 1000),
                $this->encodeJson([
                    'debit' => 'Piutang Kasbon Karyawan',
                    'credit' => $wallet['wallet_name'],
                    'cash_effect' => 'Wallet OUT',
                ]),
                'ERP_LIVE',
                $advanceId,
                'ACTIVE',
                $operationId,
                $user['user_id'] ?? null,
            ]);

            $this->insertWalletOut(
                $mutationId,
                $wallet,
                $dateValue,
                'EMPLOYEE_ADVANCE',
                $advanceId,
                $amount,
                'Kasbon ' . $employee['employee_name'] . '. ' . (string)($payload['notes'] ?? ''),
                $operationId,
                $user
            );
            $this->insertJournal(
                $journalId,
                $dateValue,
                (string)$employee['location_id'],
                'EMPLOYEE_ADVANCE',
                $advanceId,
                'Piutang Kasbon Karyawan',
                'Dompet ' . $wallet['wallet_name'],
                $amount,
                $operationId,
                $user,
                'Pengambilan kasbon ' . $employee['employee_name']
            );

            $archiveId = $this->archive->register($user, [
                'transaction_id' => $advanceId,
                'module' => 'HRD',
                'transaction_type' => 'EMPLOYEE_ADVANCE',
                'location_id' => $employee['location_id'],
                'transaction_date' => $dateValue,
                'title' => 'Kasbon — ' . $employee['employee_name'],
                'summary' => $wallet['wallet_name'] . ' · Rp' . number_format($amount, 0, ',', '.'),
                'status' => 'OPEN',
                'amount' => $amount,
                'source_table' => 'hrd_employee_advances',
                'source_key' => $advanceId,
                'snapshot' => [
                    'employee_id' => $employee['employee_id'],
                    'wallet_id' => $wallet['wallet_id'],
                    'wallet_mutation_id' => $mutationId,
                    'journal_id' => $journalId,
                ],
            ], $operationId);

            $auditId = $this->audit->record(
                $user,
                'HRD_ADVANCE',
                'CREATE',
                $advanceId,
                null,
                ['employee_id' => $employee['employee_id'], 'amount' => $amount, 'wallet_id' => $wallet['wallet_id']],
                'Kasbon karyawan dicatat',
                (string)($payload['notes'] ?? ''),
                $operationId
            );

            return [
                'message' => 'Kasbon berhasil dicatat dan uang keluar dari dompet lokasi.',
                'data' => [
                    'kasbon_id' => $advanceId,
                    'wallet_mutation_id' => $mutationId,
                    'journal_id' => $journalId,
                    'archive_id' => $archiveId,
                    'audit_id' => $auditId,
                ],
            ];
        });
    }

    public function createLoan(array $user, array $payload, array $scope, string $operationId): array
    {
        return $this->transactions->run(function () use ($user, $payload, $scope, $operationId): array {
            $employee = $this->employeeById((string)($payload['employee_id'] ?? ''), true);
            $this->assertEmployeeScope($employee, $scope);
            $wallet = $this->walletById((string)($payload['wallet_id'] ?? ''), true);
            if (!hash_equals((string)$wallet['location_id'], (string)$employee['location_id'])) {
                throw new ApiException('Dompet pinjaman harus berasal dari lokasi karyawan.', 422, 'HRD_LOAN_WALLET_LOCATION_MISMATCH');
            }

            $amount = $this->positiveMoney($payload['amount'] ?? $payload['original_amount'] ?? 0, 'Nominal pinjaman');
            if ((float)$wallet['current_balance'] + 0.0001 < $amount) {
                throw new ApiException('Saldo dompet tidak cukup untuk pinjaman ini.', 409, 'HRD_LOAN_WALLET_INSUFFICIENT', [
                    'wallet_id' => $wallet['wallet_id'],
                    'current_balance' => (float)$wallet['current_balance'],
                    'requested_amount' => $amount,
                ]);
            }
            $dateValue = $this->dateOrDefault((string)($payload['loan_date'] ?? ''), date('Y-m-d'));
            $date = new DateTimeImmutable($dateValue);
            $tenor = max(0, min(120, (int)($payload['tenor_total'] ?? $payload['tenor'] ?? 0)));
            $installment = $this->money($payload['installment_amount'] ?? 0);
            if ($installment <= 0 && $tenor > 0) {
                $installment = ceil(($amount / $tenor) / 5000) * 5000;
            }
            if ($installment > $amount) {
                $installment = $amount;
            }

            $loanId = $this->ids->next('LOAN', (string)$employee['location_code'], $date);
            $movementId = $this->ids->next('LOANMOV', (string)$employee['location_code'], $date);
            $mutationId = $this->ids->next('WM', (string)$employee['location_code'], $date);
            $journalId = $this->ids->next('JRN', (string)$employee['location_code'], $date);

            $loanStmt = $this->pdo->prepare(
                'INSERT INTO hrd_employee_loans (
                    loan_id, employee_id, location_id, loan_date,
                    original_amount, remaining_amount, tenor_total, installment_amount,
                    start_period, payment_mode, loan_category, notes,
                    source_system, source_key, status, operation_id,
                    created_by, created_at, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())'
            );
            $loanStmt->execute([
                $loanId,
                $employee['employee_id'],
                $employee['location_id'],
                $dateValue,
                $amount,
                $amount,
                $tenor,
                $installment,
                $this->periodOrDefault((string)($payload['start_period'] ?? ''), date('Y-m')),
                strtoupper(trim((string)($payload['payment_mode'] ?? 'AUTO_PAYROLL'))) ?: 'AUTO_PAYROLL',
                strtoupper(trim((string)($payload['loan_category'] ?? 'PINJAMAN_TENOR'))) ?: 'PINJAMAN_TENOR',
                $this->nullableText((string)($payload['notes'] ?? ''), 1000),
                'ERP_LIVE',
                $loanId,
                'OPEN',
                $operationId,
                $user['user_id'] ?? null,
            ]);

            $movementStmt = $this->pdo->prepare(
                'INSERT INTO hrd_employee_loan_movements (
                    loan_movement_id, loan_id, employee_id, location_id,
                    movement_date, movement_type, amount, balance_effect,
                    balance_after, locked, notes, accounting_json,
                    source_system, source_key, status, operation_id,
                    created_by, created_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, NOW())'
            );
            $movementStmt->execute([
                $movementId,
                $loanId,
                $employee['employee_id'],
                $employee['location_id'],
                $dateValue,
                'DISBURSEMENT',
                $amount,
                $amount,
                $amount,
                $this->nullableText((string)($payload['notes'] ?? ''), 1000),
                $this->encodeJson([
                    'debit' => 'Piutang Pinjaman Karyawan',
                    'credit' => $wallet['wallet_name'],
                    'cash_effect' => 'Wallet OUT',
                ]),
                'ERP_LIVE',
                $movementId,
                'ACTIVE',
                $operationId,
                $user['user_id'] ?? null,
            ]);

            $this->insertWalletOut(
                $mutationId,
                $wallet,
                $dateValue,
                'EMPLOYEE_LOAN',
                $loanId,
                $amount,
                'Pinjaman karyawan ' . $employee['employee_name'] . '. ' . (string)($payload['notes'] ?? ''),
                $operationId,
                $user
            );
            $this->insertJournal(
                $journalId,
                $dateValue,
                (string)$employee['location_id'],
                'EMPLOYEE_LOAN',
                $loanId,
                'Piutang Pinjaman Karyawan',
                'Dompet ' . $wallet['wallet_name'],
                $amount,
                $operationId,
                $user,
                'Pencairan pinjaman ' . $employee['employee_name']
            );

            $archiveId = $this->archive->register($user, [
                'transaction_id' => $loanId,
                'module' => 'HRD',
                'transaction_type' => 'EMPLOYEE_LOAN',
                'location_id' => $employee['location_id'],
                'transaction_date' => $dateValue,
                'title' => 'Pinjaman — ' . $employee['employee_name'],
                'summary' => $tenor . ' tenor · Rp' . number_format($amount, 0, ',', '.'),
                'status' => 'OPEN',
                'amount' => $amount,
                'source_table' => 'hrd_employee_loans',
                'source_key' => $loanId,
                'snapshot' => [
                    'employee_id' => $employee['employee_id'],
                    'wallet_id' => $wallet['wallet_id'],
                    'wallet_mutation_id' => $mutationId,
                    'journal_id' => $journalId,
                    'tenor_total' => $tenor,
                    'installment_amount' => $installment,
                ],
            ], $operationId);

            $auditId = $this->audit->record(
                $user,
                'HRD_LOAN',
                'CREATE',
                $loanId,
                null,
                ['employee_id' => $employee['employee_id'], 'amount' => $amount, 'tenor_total' => $tenor, 'wallet_id' => $wallet['wallet_id']],
                'Pinjaman karyawan dicatat',
                (string)($payload['notes'] ?? ''),
                $operationId
            );

            return [
                'message' => 'Pinjaman berhasil dibuat dan uang keluar dari dompet lokasi.',
                'data' => [
                    'loan_id' => $loanId,
                    'loan_movement_id' => $movementId,
                    'wallet_mutation_id' => $mutationId,
                    'journal_id' => $journalId,
                    'archive_id' => $archiveId,
                    'audit_id' => $auditId,
                ],
            ];
        });
    }

    // ---------------------------------------------------------------------
    // IMPORT NORMALIZATION
    // ---------------------------------------------------------------------

    private function normalizeBackup(array $backup): array
    {
        $errors = [];
        $warnings = [];
        $app = trim((string)($backup['app'] ?? ''));
        $version = trim((string)($backup['version'] ?? ''));
        $activePeriod = trim((string)($backup['periode_aktif'] ?? ''));
        if ($app === '') {
            $errors[] = 'Field app tidak ditemukan.';
        }
        if (!preg_match('/^\d{4}-\d{2}$/', $activePeriod)) {
            $errors[] = 'Periode aktif backup tidak valid.';
        }

        $employeesRaw = $this->decodeNestedJson($backup['employees'] ?? [], 'employees', $errors);
        $payrollRaw = $this->decodeNestedJson($backup['payroll'] ?? [], 'payroll', $errors);
        if (!is_array($employeesRaw)) {
            $employeesRaw = [];
        }
        if (!is_array($payrollRaw)) {
            $payrollRaw = [];
        }

        $locations = $this->locationMapByFriendlyName();
        $employees = [];
        $locationCounts = [];
        $statusCounts = [];
        $advanceEntryCount = 0;
        $loanMovementCount = 0;

        foreach ($employeesRaw as $name => $row) {
            if (!is_array($row)) {
                $warnings[] = 'Karyawan ' . $name . ' dilewati karena format bukan object.';
                continue;
            }
            $employeeName = $this->text((string)$name, 150);
            if ($employeeName === '') {
                $warnings[] = 'Ada karyawan tanpa nama dan dilewati.';
                continue;
            }
            $friendlyLocation = $this->text((string)($row['lokasi'] ?? ''), 100);
            $locationKey = $this->normalizeName($friendlyLocation);
            if (!isset($locations[$locationKey])) {
                $errors[] = 'Lokasi karyawan ' . $employeeName . ' belum ada di Master Lokasi: ' . $friendlyLocation;
                continue;
            }
            $location = $locations[$locationKey];
            $sourceKey = $this->normalizeName($employeeName);
            $employmentStatus = $this->employmentStatus((string)($row['employmentStatus'] ?? 'ACTIVE'));
            $salaryMode = $this->salaryMode((string)($row['gajiMode'] ?? 'BULANAN'));
            $advances = is_array($row['ledgerKasbon'] ?? null) ? array_values($row['ledgerKasbon']) : [];
            $loanMovements = is_array($row['ledgerPinjaman'] ?? null) ? array_values($row['ledgerPinjaman']) : [];
            $advanceEntryCount += count($advances);
            $loanMovementCount += count($loanMovements);
            $locationCounts[$location['location_code']] = ($locationCounts[$location['location_code']] ?? 0) + 1;
            $statusCounts[$employmentStatus] = ($statusCounts[$employmentStatus] ?? 0) + 1;

            $employees[] = [
                'source_key' => $sourceKey,
                'employee_name' => $employeeName,
                'location' => $location,
                'payroll_day' => $this->payrollDay($row['payrollDay'] ?? 28),
                'salary_mode' => $salaryMode,
                'pay_cycle' => strtoupper(trim((string)($row['payCycle'] ?? 'BULANAN'))) ?: 'BULANAN',
                'base_salary' => $this->money($row['gajiPokok'] ?? 0),
                'daily_salary' => $this->money($row['gajiHarian'] ?? 0),
                'default_work_days' => $this->decimal($row['hariKerjaDefault'] ?? 0),
                'fixed_allowance' => $this->money($row['tunjanganTetap'] ?? 0),
                'employment_status' => $employmentStatus,
                'last_payroll_period' => $this->validPeriodOrNull((string)($row['lastPayrollPeriod'] ?? '')),
                'off_effective_period' => $this->validPeriodOrNull((string)($row['offEffectivePeriod'] ?? '')),
                'off_date' => $this->validDateOrNull((string)($row['offDate'] ?? '')),
                'off_reason' => $this->nullableText((string)($row['offReason'] ?? ''), 255),
                'final_salary_received' => (bool)($row['finalSalaryReceived'] ?? false),
                'employment_history' => is_array($row['employmentHistory'] ?? null) ? $row['employmentHistory'] : [],
                'employment_cycles' => is_array($row['employmentCycles'] ?? null) ? $row['employmentCycles'] : [],
                'advance_rows' => $advances,
                'loan_rows' => $loanMovements,
                'loan_balance_authoritative' => $this->money($row['pinjamanSaldo'] ?? 0),
                'raw' => $row,
            ];
        }

        $employeeSourceKeys = array_fill_keys(array_column($employees, 'source_key'), true);
        $payrollRuns = [];
        $aliasWarnings = [];
        $closedCount = 0;
        $draftCount = 0;
        $records = is_array($payrollRaw['records'] ?? null) ? $payrollRaw['records'] : [];
        $drafts = is_array($payrollRaw['drafts'] ?? null) ? $payrollRaw['drafts'] : [];
        foreach ([['rows' => $records, 'default_status' => 'CLOSED'], ['rows' => $drafts, 'default_status' => 'DRAFT']] as $group) {
            foreach ($group['rows'] as $key => $row) {
                if (!is_array($row)) {
                    continue;
                }
                $legacyName = $this->text((string)($row['name'] ?? $this->employeeNameFromPayrollKey((string)$key)), 150);
                $name = $this->canonicalPayrollEmployeeName($legacyName);
                $sourceKey = $this->normalizeName($name);
                if ($name !== $legacyName) {
                    $warningKey = $this->normalizeName($legacyName) . '=>' . $sourceKey;
                    $aliasWarnings[$warningKey] = 'Nama payroll lama ' . $legacyName . ' dipetakan ke Master Karyawan ' . $name . '.';
                }
                if (!isset($employeeSourceKeys[$sourceKey])) {
                    $errors[] = 'Payroll ' . $key . ' mengacu ke karyawan yang tidak ada: ' . $legacyName;
                    continue;
                }
                $period = $this->validPeriodOrNull((string)($row['periode'] ?? $this->periodFromPayrollKey((string)$key)));
                if ($period === null) {
                    $warnings[] = 'Payroll ' . $key . ' dilewati karena periode tidak valid.';
                    continue;
                }
                $status = strtoupper(trim((string)($row['status'] ?? $group['default_status'])));
                $isClosed = (bool)($row['isClosed'] ?? ($status === 'CLOSED'));
                $status = $isClosed ? 'CLOSED' : 'DRAFT';
                if ($status === 'CLOSED') {
                    $closedCount++;
                } else {
                    $draftCount++;
                }
                $payrollKey = $this->text((string)($row['payrollKey'] ?? $key), 190);
                $payrollRuns[] = [
                    'source_key' => $payrollKey,
                    'employee_source_key' => $sourceKey,
                    'employee_name' => $name,
                    'period' => $period,
                    'payroll_day' => $this->payrollDay($row['payrollDay'] ?? 28),
                    'base_salary' => $this->money($row['pokok'] ?? 0),
                    'fixed_allowance' => $this->money($row['tunjangan'] ?? 0),
                    'bonus_amount' => $this->money($row['bonus'] ?? 0),
                    'overtime_amount' => $this->money($row['lembur'] ?? 0),
                    'absence_days' => $this->decimal($row['absenHari'] ?? 0),
                    'absence_deduction' => $this->money($row['potAbsen'] ?? 0),
                    'advance_deduction' => $this->money($row['potKasbon'] ?? 0),
                    'loan_deduction' => $this->money($row['potPinjaman'] ?? 0),
                    'extra_deduction' => max(0, $this->money($row['potongan'] ?? 0)
                        - $this->money($row['potAbsen'] ?? 0)
                        - $this->money($row['potKasbon'] ?? 0)
                        - $this->money($row['potPinjaman'] ?? 0)),
                    'total_income' => $this->money($row['pendapatan'] ?? 0),
                    'total_deduction' => $this->money($row['potongan'] ?? 0),
                    'net_pay' => $this->money($row['bersih'] ?? 0),
                    'loan_balance_before' => $this->money($row['pinjamanAwal'] ?? 0),
                    'loan_balance_after' => $this->money($row['sisaPinjaman'] ?? 0),
                    'status' => $status,
                    'closed_at' => $this->isoDateTimeToMysql((string)($row['closedAt'] ?? '')),
                    'closed_date' => $this->validDateOrNull((string)($row['closedDate'] ?? '')),
                    'print_count' => max(0, (int)($row['printCount'] ?? 0)),
                    'ledger_refs' => is_array($row['ledgerRefs'] ?? null) ? $row['ledgerRefs'] : [],
                    'raw' => $row,
                ];
            }
        }

        foreach ($aliasWarnings as $aliasWarning) {
            $warnings[] = $aliasWarning;
        }

        if ($version !== '' && strtoupper($version) !== 'V32') {
            $warnings[] = 'Metadata backup bertuliskan ' . $version . '. Ini dapat terjadi jika nomor versi fungsi export belum diperbarui; struktur data tetap divalidasi.';
        }

        $exportedAt = $this->isoDateTimeToMysql((string)($backup['exported_at'] ?? ''));
        return [
            'source' => [
                'app' => $app !== '' ? $app : 'Dimsum Aditya Payroll',
                'version' => $version !== '' ? $version : 'UNKNOWN',
                'exported_at' => (string)($backup['exported_at'] ?? ''),
                'exported_at_mysql' => $exportedAt,
                'active_period' => $activePeriod,
            ],
            'summary' => [
                'employee_count' => count($employees),
                'active_employee_count' => (int)($statusCounts['ACTIVE'] ?? 0),
                'inactive_employee_count' => (int)($statusCounts['INACTIVE'] ?? 0),
                'ending_employee_count' => (int)($statusCounts['ENDING'] ?? 0),
                'payroll_closed_count' => $closedCount,
                'payroll_draft_count' => $draftCount,
                'advance_entry_count' => $advanceEntryCount,
                'loan_movement_count' => $loanMovementCount,
                'location_count' => count($locationCounts),
                'location_employee_counts' => $locationCounts,
            ],
            'locations' => array_values(array_reduce($locations, static function (array $carry, array $location): array {
                $carry[(string)$location['location_id']] = $location;
                return $carry;
            }, [])),
            'employees' => $employees,
            'payroll_runs' => $payrollRuns,
            'warnings' => array_values(array_unique($warnings)),
            'errors' => array_values(array_unique($errors)),
        ];
    }

    private function upsertImportedEmployee(
        array $user,
        array $data,
        string $importBatchId,
        string $operationId,
        array &$inserted
    ): array {
        $find = $this->pdo->prepare(
            "SELECT * FROM hrd_employees
             WHERE source_system = 'PAYROLL_V32' AND source_key = ?
             LIMIT 1 FOR UPDATE"
        );
        $find->execute([$data['source_key']]);
        $existing = $find->fetch();
        if ($existing) {
            return $existing;
        }

        $location = $data['location'];
        $date = new DateTimeImmutable('now');
        $employeeId = $this->ids->next('EMP', (string)$location['location_code'], $date);
        $employeeCode = $this->employeeCode($employeeId, (string)$data['employee_name']);
        $stmt = $this->pdo->prepare(
            'INSERT INTO hrd_employees (
                employee_id, employee_code, employee_name, normalized_name,
                location_id, location_code, location_name_snapshot,
                position_name, payroll_day, salary_mode, pay_cycle,
                base_salary, daily_salary, default_work_days, fixed_allowance,
                employment_status, last_payroll_period, off_effective_period,
                off_date, off_reason, final_salary_received,
                source_system, source_key, source_snapshot_json, import_batch_id,
                status, operation_id, created_by, created_at, updated_by, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())'
        );
        $stmt->execute([
            $employeeId,
            $employeeCode,
            $data['employee_name'],
            $data['source_key'],
            $location['location_id'],
            $location['location_code'],
            $location['location_name'],
            $data['payroll_day'],
            $data['salary_mode'],
            $data['pay_cycle'],
            $data['base_salary'],
            $data['daily_salary'],
            $data['default_work_days'],
            $data['fixed_allowance'],
            $data['employment_status'],
            $data['last_payroll_period'],
            $data['off_effective_period'],
            $data['off_date'],
            $data['off_reason'],
            $data['final_salary_received'] ? 1 : 0,
            'PAYROLL_V32',
            $data['source_key'],
            $this->encodeJson($data['raw']),
            $importBatchId,
            'ACTIVE',
            $operationId,
            $user['user_id'] ?? null,
            $user['user_id'] ?? null,
        ]);
        $inserted['employees']++;

        $effectivePeriod = $data['last_payroll_period']
            ?? $data['off_effective_period']
            ?? date('Y-m');
        $salaryHistoryId = $this->ids->next('SALHIST', (string)$location['location_code'], $date);
        $salaryStmt = $this->pdo->prepare(
            'INSERT INTO hrd_employee_salary_history (
                salary_history_id, employee_id, effective_period, salary_mode,
                base_salary, daily_salary, default_work_days, fixed_allowance,
                source_type, source_id, notes, import_batch_id,
                operation_id, created_by, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
        );
        $salaryStmt->execute([
            $salaryHistoryId,
            $employeeId,
            $effectivePeriod,
            $data['salary_mode'],
            $data['base_salary'],
            $data['daily_salary'],
            $data['default_work_days'],
            $data['fixed_allowance'],
            'V32_MASTER_IMPORT',
            $data['source_key'],
            'Snapshot master saat import backup Payroll.',
            $importBatchId,
            $operationId,
            $user['user_id'] ?? null,
        ]);
        $inserted['salary_history']++;

        foreach ($data['employment_history'] as $index => $history) {
            if (!is_array($history)) {
                continue;
            }
            $sourceKey = trim((string)($history['id'] ?? ''));
            if ($sourceKey === '') {
                $sourceKey = 'STATUS-' . substr(hash('sha256', $data['source_key'] . '|' . $index . '|' . $this->encodeJson($history)), 0, 24);
            }
            $statusId = $this->ids->next('EMPSTAT', (string)$location['location_code'], $date);
            $statusStmt = $this->pdo->prepare(
                'INSERT IGNORE INTO hrd_employee_status_history (
                    status_history_id, employee_id, effective_period, effective_date,
                    from_status, to_status, reason, final_salary_received,
                    source_key, snapshot_json, import_batch_id,
                    operation_id, created_by, created_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
            );
            $statusStmt->execute([
                $statusId,
                $employeeId,
                $this->validPeriodOrNull((string)($history['offEffectivePeriod'] ?? $history['lastPayrollPeriod'] ?? '')),
                $this->validDateOrNull((string)($history['offDate'] ?? '')),
                $this->employmentStatus((string)($history['from'] ?? 'ACTIVE')),
                $this->employmentStatus((string)($history['to'] ?? $data['employment_status'])),
                $this->nullableText((string)($history['offReason'] ?? $history['reason'] ?? ''), 255),
                (bool)($history['finalSalaryReceived'] ?? false) ? 1 : 0,
                $sourceKey,
                $this->encodeJson($history),
                $importBatchId,
                $operationId,
                $user['user_id'] ?? null,
            ]);
            if ($statusStmt->rowCount() > 0) {
                $inserted['status_history']++;
            }
        }

        return $this->employeeById($employeeId, false);
    }

    private function importAdvanceRows(
        array $user,
        array $employee,
        array $employeeData,
        string $importBatchId,
        string $operationId,
        array &$inserted
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT IGNORE INTO hrd_employee_advances (
                advance_entry_id, employee_id, location_id, entry_date,
                entry_type, amount, balance_effect, payroll_key, locked,
                notes, accounting_json, source_system, source_key,
                import_batch_id, status, operation_id, created_by,
                created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
        );
        foreach ($employeeData['advance_rows'] as $index => $row) {
            if (!is_array($row)) {
                continue;
            }
            $sourceKey = trim((string)($row['id'] ?? ''));
            if ($sourceKey === '') {
                $sourceKey = 'ADV-' . substr(hash('sha256', $employeeData['source_key'] . '|' . $index . '|' . $this->encodeJson($row)), 0, 28);
            }
            $entryType = $this->advanceEntryType((string)($row['type'] ?? 'Ambil'));
            $amount = $this->money($row['amount'] ?? 0);
            $balanceEffect = in_array($entryType, ['SETTLEMENT', 'REVERSAL'], true) ? -$amount : $amount;
            $entryDate = $this->dateOrDefault((string)($row['date'] ?? ''), date('Y-m-d'));
            $createdAt = $this->isoDateTimeToMysql((string)($row['createdAt'] ?? '')) ?? ($entryDate . ' 00:00:00');
            $entryId = $this->ids->next('KASBON', (string)$employee['location_code'], new DateTimeImmutable($entryDate));
            $stmt->execute([
                $entryId,
                $employee['employee_id'],
                $employee['location_id'],
                $entryDate,
                $entryType,
                $amount,
                $balanceEffect,
                $this->nullableText((string)($row['payrollKey'] ?? ''), 190),
                (bool)($row['locked'] ?? false) ? 1 : 0,
                $this->nullableText((string)($row['note'] ?? ''), 1000),
                $this->encodeJson($row['accounting'] ?? null),
                'PAYROLL_V32',
                $sourceKey,
                $importBatchId,
                'LEGACY_IMPORTED',
                $operationId,
                $user['user_id'] ?? null,
                $createdAt,
            ]);
            if ($stmt->rowCount() > 0) {
                $inserted['advances']++;
            }
        }
    }

    private function importLoanRows(
        array $user,
        array $employee,
        array $employeeData,
        string $importBatchId,
        string $operationId,
        array &$inserted
    ): void {
        $groups = [];
        foreach ($employeeData['loan_rows'] as $index => $row) {
            if (!is_array($row)) {
                continue;
            }
            $type = $this->loanMovementType((string)($row['type'] ?? ''));
            $sourceLoanKey = trim((string)($row['sourceLoanId'] ?? $row['loanId'] ?? ''));
            if ($sourceLoanKey === '') {
                $sourceLoanKey = $type === 'DISBURSEMENT'
                    ? trim((string)($row['id'] ?? ''))
                    : 'LEGACY-' . $employeeData['source_key'];
            }
            if ($sourceLoanKey === '') {
                $sourceLoanKey = 'LEGACY-' . $employeeData['source_key'];
            }
            $groups[$sourceLoanKey][] = ['row' => $row, 'index' => $index, 'type' => $type];
        }

        if ($groups === [] && $employeeData['loan_balance_authoritative'] > 0) {
            $groups['OPENING-' . $employeeData['source_key']] = [[
                'row' => [
                    'id' => 'OPENING-' . $employeeData['source_key'],
                    'date' => date('Y-m-d'),
                    'amount' => $employeeData['loan_balance_authoritative'],
                    'type' => 'Tambah Pinjaman',
                    'note' => 'Saldo pinjaman opening dari backup V32.',
                    'balance' => $employeeData['loan_balance_authoritative'],
                ],
                'index' => 0,
                'type' => 'DISBURSEMENT',
            ]];
        }

        $createdLoans = [];
        foreach ($groups as $sourceLoanKey => $movementRows) {
            $opening = null;
            foreach ($movementRows as $movement) {
                if ($movement['type'] === 'DISBURSEMENT') {
                    $opening = $movement['row'];
                    break;
                }
            }
            if ($opening === null) {
                $opening = $movementRows[0]['row'];
            }
            $loanDate = $this->dateOrDefault((string)($opening['date'] ?? ''), date('Y-m-d'));
            $originalAmount = $this->money($opening['amount'] ?? 0);
            $latestBalance = null;
            foreach ($movementRows as $movement) {
                if (isset($movement['row']['balance'])) {
                    $latestBalance = $this->money($movement['row']['balance']);
                }
            }
            $remaining = $latestBalance ?? max(0, $originalAmount);
            $loanId = $this->ids->next('LOAN', (string)$employee['location_code'], new DateTimeImmutable($loanDate));
            $loanStmt = $this->pdo->prepare(
                'INSERT IGNORE INTO hrd_employee_loans (
                    loan_id, employee_id, location_id, loan_date,
                    original_amount, remaining_amount, tenor_total,
                    installment_amount, start_period, payment_mode,
                    loan_category, notes, source_system, source_key,
                    import_batch_id, status, operation_id, created_by,
                    created_at, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())'
            );
            $loanStmt->execute([
                $loanId,
                $employee['employee_id'],
                $employee['location_id'],
                $loanDate,
                $originalAmount,
                max(0, $remaining),
                max(0, (int)($opening['tenor'] ?? 0)),
                $this->money($opening['installmentAmount'] ?? 0),
                $this->validPeriodOrNull((string)($opening['startPeriod'] ?? '')),
                strtoupper(trim((string)($opening['paymentMode'] ?? 'MANUAL'))) ?: 'MANUAL',
                strtoupper(trim((string)($opening['category'] ?? 'PINJAMAN_MANUAL'))) ?: 'PINJAMAN_MANUAL',
                $this->nullableText((string)($opening['note'] ?? ''), 1000),
                'PAYROLL_V32',
                $sourceLoanKey,
                $importBatchId,
                $remaining > 0 ? 'OPEN' : 'CLOSED',
                $operationId,
                $user['user_id'] ?? null,
            ]);
            if ($loanStmt->rowCount() > 0) {
                $inserted['loans']++;
                $createdLoans[$sourceLoanKey] = $loanId;
            } else {
                $findLoan = $this->pdo->prepare(
                    "SELECT loan_id FROM hrd_employee_loans
                     WHERE source_system = 'PAYROLL_V32' AND source_key = ? LIMIT 1"
                );
                $findLoan->execute([$sourceLoanKey]);
                $createdLoans[$sourceLoanKey] = (string)$findLoan->fetchColumn();
            }

            foreach ($movementRows as $movement) {
                $row = $movement['row'];
                $sourceKey = trim((string)($row['id'] ?? ''));
                if ($sourceKey === '') {
                    $sourceKey = 'LOANMOV-' . substr(hash('sha256', $employeeData['source_key'] . '|' . $movement['index'] . '|' . $this->encodeJson($row)), 0, 24);
                }
                $amount = $this->money($row['amount'] ?? 0);
                $movementType = $movement['type'];
                $effect = in_array($movementType, ['INSTALLMENT', 'SETTLEMENT'], true) ? -$amount : $amount;
                $movementDate = $this->dateOrDefault((string)($row['date'] ?? ''), $loanDate);
                $movementId = $this->ids->next('LOANMOV', (string)$employee['location_code'], new DateTimeImmutable($movementDate));
                $movementStmt = $this->pdo->prepare(
                    'INSERT IGNORE INTO hrd_employee_loan_movements (
                        loan_movement_id, loan_id, employee_id, location_id,
                        movement_date, movement_type, amount, balance_effect,
                        balance_after, payroll_key, installment_no, locked,
                        notes, accounting_json, source_system, source_key,
                        import_batch_id, status, operation_id, created_by, created_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                $movementStmt->execute([
                    $movementId,
                    $createdLoans[$sourceLoanKey],
                    $employee['employee_id'],
                    $employee['location_id'],
                    $movementDate,
                    $movementType,
                    $amount,
                    $effect,
                    isset($row['balance']) ? $this->money($row['balance']) : null,
                    $this->nullableText((string)($row['payrollKey'] ?? ''), 190),
                    isset($row['installmentNo']) ? (int)$row['installmentNo'] : null,
                    (bool)($row['locked'] ?? false) ? 1 : 0,
                    $this->nullableText((string)($row['note'] ?? ''), 1000),
                    $this->encodeJson($row['accounting'] ?? null),
                    'PAYROLL_V32',
                    $sourceKey,
                    $importBatchId,
                    'LEGACY_IMPORTED',
                    $operationId,
                    $user['user_id'] ?? null,
                    $this->isoDateTimeToMysql((string)($row['createdAt'] ?? '')) ?? ($movementDate . ' 00:00:00'),
                ]);
                if ($movementStmt->rowCount() > 0) {
                    $inserted['loan_movements']++;
                }
            }
        }

        $authoritative = $employeeData['loan_balance_authoritative'];
        if ($authoritative >= 0 && $createdLoans !== []) {
            $sumStmt = $this->pdo->prepare(
                'SELECT COALESCE(SUM(remaining_amount), 0) FROM hrd_employee_loans
                 WHERE employee_id = ? AND import_batch_id = ?'
            );
            $sumStmt->execute([$employee['employee_id'], $importBatchId]);
            $currentSum = (float)$sumStmt->fetchColumn();
            $difference = $authoritative - $currentSum;
            if (abs($difference) > 0.5) {
                $targetLoanId = (string)reset($createdLoans);
                $adjustStmt = $this->pdo->prepare(
                    'UPDATE hrd_employee_loans
                     SET remaining_amount = GREATEST(0, remaining_amount + ?),
                         status = CASE WHEN GREATEST(0, remaining_amount + ?) > 0 THEN \'OPEN\' ELSE \'CLOSED\' END,
                         updated_at = NOW()
                     WHERE loan_id = ?'
                );
                $adjustStmt->execute([$difference, $difference, $targetLoanId]);
            }
        }
    }

    private function importPayrollRun(
        array $user,
        array $employee,
        array $data,
        string $importBatchId,
        string $operationId,
        array &$inserted
    ): void {
        $find = $this->pdo->prepare('SELECT payroll_run_id FROM hrd_payroll_runs WHERE payroll_key = ? LIMIT 1');
        $find->execute([$data['source_key']]);
        if ($find->fetchColumn() !== false) {
            return;
        }
        $date = new DateTimeImmutable(($data['closed_date'] ?: ($data['period'] . '-01')));
        $payrollRunId = $this->ids->next('PAYRUN', (string)$employee['location_code'], $date);
        $stmt = $this->pdo->prepare(
            'INSERT INTO hrd_payroll_runs (
                payroll_run_id, payroll_key, period, employee_id,
                employee_name_snapshot, location_id, location_name_snapshot,
                payroll_day, base_salary, fixed_allowance, bonus_amount,
                overtime_amount, absence_days, absence_deduction,
                advance_deduction, loan_deduction, extra_deduction,
                total_income, total_deduction, net_pay,
                loan_balance_before, loan_balance_after,
                status, payment_status, closed_at, closed_date, closed_by,
                print_count, ledger_refs_json, snapshot_json,
                source_system, source_key, import_batch_id,
                operation_id, created_by, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())'
        );
        $stmt->execute([
            $payrollRunId,
            $data['source_key'],
            $data['period'],
            $employee['employee_id'],
            $employee['employee_name'],
            $employee['location_id'],
            $employee['location_name_snapshot'],
            $data['payroll_day'],
            $data['base_salary'],
            $data['fixed_allowance'],
            $data['bonus_amount'],
            $data['overtime_amount'],
            $data['absence_days'],
            $data['absence_deduction'],
            $data['advance_deduction'],
            $data['loan_deduction'],
            $data['extra_deduction'],
            $data['total_income'],
            $data['total_deduction'],
            $data['net_pay'],
            $data['loan_balance_before'],
            $data['loan_balance_after'],
            $data['status'],
            'UNPAID_LEGACY',
            $data['closed_at'],
            $data['closed_date'],
            $data['status'] === 'CLOSED' ? ($user['user_id'] ?? null) : null,
            $data['print_count'],
            $this->encodeJson($data['ledger_refs']),
            $this->encodeJson($data['raw']),
            'PAYROLL_V32',
            $data['source_key'],
            $importBatchId,
            $operationId,
            $user['user_id'] ?? null,
        ]);
        $inserted['payroll_runs']++;

        $salaryHistoryId = $this->ids->next('SALHIST', (string)$employee['location_code'], $date);
        $salaryStmt = $this->pdo->prepare(
            'INSERT IGNORE INTO hrd_employee_salary_history (
                salary_history_id, employee_id, effective_period,
                salary_mode, base_salary, daily_salary,
                default_work_days, fixed_allowance,
                source_type, source_id, notes, import_batch_id,
                operation_id, created_by, created_at
             ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, NOW())'
        );
        $salaryStmt->execute([
            $salaryHistoryId,
            $employee['employee_id'],
            $data['period'],
            $employee['salary_mode'],
            $data['base_salary'],
            $data['fixed_allowance'],
            'V32_PAYROLL_SNAPSHOT',
            $payrollRunId,
            'Snapshot gaji dari payroll ' . $data['source_key'],
            $importBatchId,
            $operationId,
            $user['user_id'] ?? null,
        ]);
        if ($salaryStmt->rowCount() > 0) {
            $inserted['salary_history']++;
        }
    }

    // ---------------------------------------------------------------------
    // READ QUERIES
    // ---------------------------------------------------------------------

    private function employeeRows(?string $locationId, bool $fullAccess): array
    {
        $sql = 'SELECT employee_id, employee_code, employee_name, location_id,
                       location_code, location_name_snapshot, position_name,
                       payroll_day, salary_mode, pay_cycle, base_salary,
                       daily_salary, default_work_days, fixed_allowance,
                       employment_status, last_payroll_period,
                       off_effective_period, off_date, off_reason,
                       final_salary_received, source_system, source_key,
                       import_batch_id, status, created_at, updated_at
                FROM hrd_employees
                WHERE status = \'ACTIVE\'';
        $params = [];
        if ($locationId !== null && $locationId !== '') {
            $sql .= ' AND location_id = ?';
            $params[] = $locationId;
        }
        $sql .= ' ORDER BY FIELD(employment_status, \'ACTIVE\', \'ENDING\', \'INACTIVE\'), location_code, employee_name';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    private function advanceRows(array $employeeIds, string $period): array
    {
        if ($employeeIds === []) {
            return [];
        }
        [$in, $params] = $this->inClause($employeeIds);
        $params[] = $period . '-01';
        $params[] = date('Y-m-t', strtotime($period . '-01'));
        $stmt = $this->pdo->prepare(
            "SELECT a.*, e.employee_name, e.location_code
             FROM hrd_employee_advances a
             JOIN hrd_employees e ON e.employee_id = a.employee_id
             WHERE a.employee_id IN ($in)
               AND a.entry_date BETWEEN ? AND ?
               AND a.status <> 'VOID'
             ORDER BY a.entry_date DESC, a.created_at DESC"
        );
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    private function loanRows(array $employeeIds): array
    {
        if ($employeeIds === []) {
            return [];
        }
        [$in, $params] = $this->inClause($employeeIds);
        $stmt = $this->pdo->prepare(
            "SELECT l.*, e.employee_name, e.location_code,
                    (SELECT COUNT(*) FROM hrd_employee_loan_movements m
                     WHERE m.loan_id = l.loan_id AND m.movement_type IN ('INSTALLMENT','SETTLEMENT')) AS tenor_paid
             FROM hrd_employee_loans l
             JOIN hrd_employees e ON e.employee_id = l.employee_id
             WHERE l.employee_id IN ($in)
             ORDER BY FIELD(l.status, 'OPEN', 'CLOSED'), l.loan_date DESC"
        );
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    private function attendanceRows(array $employeeIds, string $period): array
    {
        if ($employeeIds === []) {
            return [];
        }
        [$in, $params] = $this->inClause($employeeIds);
        $params[] = $period . '-01';
        $params[] = date('Y-m-t', strtotime($period . '-01'));
        $stmt = $this->pdo->prepare(
            "SELECT a.*, e.employee_name, e.location_code
             FROM hrd_attendance_entries a
             JOIN hrd_employees e ON e.employee_id = a.employee_id
             WHERE a.employee_id IN ($in)
               AND a.attendance_date BETWEEN ? AND ?
               AND a.status = 'ACTIVE'
             ORDER BY a.attendance_date DESC, e.employee_name"
        );
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    private function payrollRows(?string $locationId, string $period): array
    {
        $sql = 'SELECT payroll_run_id, payroll_key, period, employee_id,
                       employee_name_snapshot AS employee_name,
                       location_id, location_name_snapshot AS location_name,
                       payroll_day, base_salary, fixed_allowance,
                       bonus_amount, overtime_amount, absence_days,
                       absence_deduction, advance_deduction, loan_deduction,
                       extra_deduction, total_income, total_deduction, net_pay,
                       loan_balance_before, loan_balance_after,
                       status, payment_status, closed_at, closed_date,
                       print_count, source_system, import_batch_id,
                       created_at, updated_at
                FROM hrd_payroll_runs
                WHERE period = ?';
        $params = [$period];
        if ($locationId !== null && $locationId !== '') {
            $sql .= ' AND location_id = ?';
            $params[] = $locationId;
        }
        $sql .= ' ORDER BY payroll_day, location_name_snapshot, employee_name_snapshot';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    private function advanceBalances(array $employeeIds): array
    {
        if ($employeeIds === []) {
            return [];
        }
        [$in, $params] = $this->inClause($employeeIds);
        $stmt = $this->pdo->prepare(
            "SELECT employee_id, COALESCE(SUM(balance_effect), 0) AS balance
             FROM hrd_employee_advances
             WHERE employee_id IN ($in) AND status <> 'VOID'
             GROUP BY employee_id"
        );
        $stmt->execute($params);
        $result = [];
        foreach ($stmt->fetchAll() as $row) {
            $result[(string)$row['employee_id']] = max(0, (float)$row['balance']);
        }
        return $result;
    }

    private function loanBalances(array $employeeIds): array
    {
        if ($employeeIds === []) {
            return [];
        }
        [$in, $params] = $this->inClause($employeeIds);
        $stmt = $this->pdo->prepare(
            "SELECT employee_id, COALESCE(SUM(remaining_amount), 0) AS balance
             FROM hrd_employee_loans
             WHERE employee_id IN ($in) AND status <> 'VOID'
             GROUP BY employee_id"
        );
        $stmt->execute($params);
        $result = [];
        foreach ($stmt->fetchAll() as $row) {
            $result[(string)$row['employee_id']] = max(0, (float)$row['balance']);
        }
        return $result;
    }

    private function walletRows(?string $locationId, bool $isGlobal): array
    {
        $sql = 'SELECT w.wallet_id, w.wallet_code, w.wallet_name, w.location_id,
                       l.location_code, l.location_name, w.status,
                       COALESCE(v.current_balance, 0) AS current_balance
                FROM wallets w
                JOIN locations l ON l.location_id = w.location_id
                LEFT JOIN vw_wallet_balances_live v ON v.wallet_id = w.wallet_id
                WHERE UPPER(w.status) IN (\'ACTIVE\', \'AKTIF\')';
        $params = [];
        if ($locationId !== null && $locationId !== '') {
            $sql .= ' AND w.location_id = ?';
            $params[] = $locationId;
        }
        $sql .= ' ORDER BY l.location_code, w.wallet_name';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    private function activeLocations(): array
    {
        return $this->pdo->query(
            "SELECT location_id, location_code, location_name, location_type,
                    parent_location, status
             FROM locations
             WHERE UPPER(status) IN ('ACTIVE','AKTIF')
             ORDER BY FIELD(location_code, 'TGR','PML','CBN'), location_name"
        )->fetchAll();
    }

    private function importBatchRows(): array
    {
        return $this->pdo->query(
            'SELECT import_batch_id, source_app, source_version,
                    source_exported_at, active_period, checksum_sha256,
                    file_name, employee_count, payroll_closed_count,
                    payroll_draft_count, advance_entry_count,
                    loan_movement_count, status, imported_by, imported_at
             FROM hrd_payroll_import_batches
             ORDER BY imported_at DESC
             LIMIT 20'
        )->fetchAll();
    }

    private function summary(array $employees, array $advanceBalances, array $loanBalances, array $payrollRows, string $period): array
    {
        $active = 0;
        $inactive = 0;
        $ending = 0;
        $locations = [];
        foreach ($employees as $employee) {
            $status = strtoupper((string)$employee['employment_status']);
            if ($status === 'ACTIVE') {
                $active++;
            } elseif ($status === 'ENDING') {
                $ending++;
            } else {
                $inactive++;
            }
            $locations[(string)$employee['location_code']] = true;
        }
        $closed = 0;
        $draft = 0;
        $totalNetPay = 0.0;
        foreach ($payrollRows as $row) {
            if (strtoupper((string)$row['status']) === 'CLOSED') {
                $closed++;
            } else {
                $draft++;
            }
            $totalNetPay += (float)$row['net_pay'];
        }
        return [
            'period' => $period,
            'employee_count' => count($employees),
            'active_employee_count' => $active,
            'inactive_employee_count' => $inactive,
            'ending_employee_count' => $ending,
            'location_count' => count($locations),
            'open_advance_amount' => array_sum($advanceBalances),
            'open_loan_amount' => array_sum($loanBalances),
            'payroll_closed_count' => $closed,
            'payroll_draft_count' => $draft,
            'payroll_total_net_pay' => $totalNetPay,
        ];
    }

    // ---------------------------------------------------------------------
    // DB HELPERS
    // ---------------------------------------------------------------------

    private function insertWalletOut(
        string $mutationId,
        array $wallet,
        string $date,
        string $sourceModule,
        string $sourceId,
        float $amount,
        string $notes,
        string $operationId,
        array $user
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO wallet_mutations (
                mutation_id, mutation_no, wallet_id, location_id,
                mutation_date, mutation_type, source_module, source_id,
                direction, amount, balance_effect, notes, status,
                created_by, created_at, operation_id
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)'
        );
        $stmt->execute([
            $mutationId,
            $mutationId,
            $wallet['wallet_id'],
            $wallet['location_id'],
            $date,
            'HRD_DISBURSEMENT',
            $sourceModule,
            $sourceId,
            'OUT',
            $amount,
            -$amount,
            $this->text($notes, 2000),
            'Active',
            $user['user_id'] ?? null,
            $operationId,
        ]);
    }

    private function insertJournal(
        string $journalId,
        string $date,
        string $locationId,
        string $sourceModule,
        string $sourceId,
        string $debitAccount,
        string $creditAccount,
        float $amount,
        string $operationId,
        array $user,
        string $notes
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO accounting_journals (
                journal_id, journal_no, journal_date, location_id,
                source_module, source_id, debit_account, credit_account,
                amount, cash_amount, payable_amount, journal_lines_json,
                notes, status, created_by, created_at, operation_id
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NOW(), ?)'
        );
        $stmt->execute([
            $journalId,
            $journalId,
            $date,
            $locationId,
            $sourceModule,
            $sourceId,
            $debitAccount,
            $creditAccount,
            $amount,
            $amount,
            $this->encodeJson([
                ['account' => $debitAccount, 'direction' => 'DEBIT', 'amount' => $amount],
                ['account' => $creditAccount, 'direction' => 'CREDIT', 'amount' => $amount],
            ]),
            $notes,
            'POSTED',
            $user['user_id'] ?? null,
            $operationId,
        ]);
    }

    private function employeeById(string $employeeId, bool $lock): array
    {
        $employeeId = $this->requiredIdentifier($employeeId, 'Employee ID');
        $sql = 'SELECT * FROM hrd_employees WHERE employee_id = ? AND status = \'ACTIVE\' LIMIT 1';
        if ($lock) {
            $sql .= ' FOR UPDATE';
        }
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$employeeId]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new ApiException('Karyawan tidak ditemukan.', 404, 'HRD_EMPLOYEE_NOT_FOUND');
        }
        return $row;
    }

    private function walletById(string $walletId, bool $lock): array
    {
        $walletId = $this->requiredIdentifier($walletId, 'Wallet ID');
        $sql = "SELECT w.*, l.location_code, l.location_name,
                       COALESCE(v.current_balance, 0) AS current_balance
                FROM wallets w
                JOIN locations l ON l.location_id = w.location_id
                LEFT JOIN vw_wallet_balances_live v ON v.wallet_id = w.wallet_id
                WHERE w.wallet_id = ? AND UPPER(w.status) IN ('ACTIVE','AKTIF') LIMIT 1";
        if ($lock) {
            $sql .= ' FOR UPDATE';
        }
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$walletId]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new ApiException('Dompet tidak ditemukan atau tidak aktif.', 404, 'HRD_WALLET_NOT_FOUND');
        }
        return $row;
    }

    private function activeLocationByAny(string $value): array
    {
        $value = trim($value);
        if ($value === '') {
            throw new ApiException('Lokasi wajib dipilih.', 422, 'HRD_LOCATION_REQUIRED');
        }
        $stmt = $this->pdo->prepare(
            "SELECT location_id, location_code, location_name, location_type, parent_location, status
             FROM locations
             WHERE (location_id = ? OR UPPER(location_code) = UPPER(?) OR UPPER(location_name) = UPPER(?))
               AND UPPER(status) IN ('ACTIVE','AKTIF')
             LIMIT 1"
        );
        $stmt->execute([$value, $value, $value]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new ApiException('Lokasi tidak ditemukan atau tidak aktif.', 404, 'HRD_LOCATION_NOT_FOUND');
        }
        return $row;
    }

    private function locationMapByFriendlyName(): array
    {
        $result = [];
        foreach ($this->activeLocations() as $location) {
            $keys = [
                $this->normalizeName((string)$location['location_name']),
                $this->normalizeName((string)$location['location_code']),
            ];
            $code = strtoupper((string)$location['location_code']);
            if ($code === 'TGR') {
                $keys[] = 'TANGERANG';
                $keys[] = 'TANGERANG HO';
            } elseif ($code === 'PML') {
                $keys[] = 'PEMALANG';
                $keys[] = 'PRODUKSI PEMALANG';
            } elseif ($code === 'CBN') {
                $keys[] = 'CIBINONG';
                $keys[] = 'RESTO CIBINONG';
            }
            foreach (array_unique($keys) as $key) {
                if ($key !== '') {
                    $result[$key] = $location;
                }
            }
        }
        return $result;
    }

    private function findImportByChecksum(string $checksum, bool $lock = false): ?array
    {
        $sql = 'SELECT * FROM hrd_payroll_import_batches WHERE checksum_sha256 = ? LIMIT 1';
        if ($lock) {
            $sql .= ' FOR UPDATE';
        }
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$checksum]);
        return $stmt->fetch() ?: null;
    }

    private function assertEmployeeScope(array $employee, array $scope): void
    {
        if ($this->isGlobalScope($scope)) {
            return;
        }
        $own = $this->scopeLocationId($scope);
        if ($own === null || !hash_equals((string)$employee['location_id'], $own)) {
            throw new ApiException('Akun cabang hanya dapat mengelola karyawan lokasinya sendiri.', 403, 'HRD_EMPLOYEE_SCOPE_DENIED');
        }
    }

    private function fullPayrollAccess(array $user, array $scope): bool
    {
        $role = strtoupper((string)($user['role_id'] ?? ''));
        return $role === 'ROLE-OWNER' || $role === 'ROLE-HO-ADMIN' || $this->isGlobalScope($scope);
    }

    private function isGlobalScope(array $scope): bool
    {
        return (bool)($scope['all_locations'] ?? false)
            || (($scope['location_mode'] ?? '') === 'global' && ($scope['location'] ?? null) === null);
    }

    private function scopeLocationId(array $scope): ?string
    {
        $location = $scope['location'] ?? null;
        $id = is_array($location) ? trim((string)($location['location_id'] ?? '')) : '';
        return $id !== '' ? $id : null;
    }

    private function assertReady(): void
    {
        $health = $this->health();
        if (!$health['ready']) {
            throw new ApiException('Migration 021 HRD/Payroll belum siap.', 503, 'HRD_PAYROLL_NOT_READY', $health);
        }
    }

    private function tableExists(string $table): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = ?'
        );
        $stmt->execute([$table]);
        return (int)$stmt->fetchColumn() === 1;
    }

    // ---------------------------------------------------------------------
    // VALIDATION / FORMAT HELPERS
    // ---------------------------------------------------------------------

    private function backupPayload(array $payload): array
    {
        $backup = $payload['backup'] ?? $payload['data'] ?? $payload;
        if (is_string($backup)) {
            $decoded = json_decode($backup, true);
            if (!is_array($decoded)) {
                throw new ApiException('Isi backup bukan JSON valid.', 422, 'HRD_IMPORT_JSON_INVALID');
            }
            $backup = $decoded;
        }
        if (!is_array($backup)) {
            throw new ApiException('Backup Payroll wajib berupa object JSON.', 422, 'HRD_IMPORT_BACKUP_REQUIRED');
        }
        return $backup;
    }

    private function decodeNestedJson($value, string $label, array &$errors)
    {
        if (is_array($value)) {
            return $value;
        }
        if (!is_string($value) || trim($value) === '') {
            $errors[] = 'Data ' . $label . ' kosong.';
            return [];
        }
        $decoded = json_decode($value, true);
        if (!is_array($decoded)) {
            $errors[] = 'Data ' . $label . ' tidak dapat dibaca sebagai JSON.';
            return [];
        }
        return $decoded;
    }

    private function employeeNameFromPayrollKey(string $key): string
    {
        $parts = explode('__', $key);
        if (count($parts) < 2) {
            return '';
        }
        return (string)end($parts);
    }

    private function canonicalPayrollEmployeeName(string $legacyName): string
    {
        $normalized = $this->normalizeName($legacyName);
        $aliases = [
            'PAK RASULI' => 'OM ROSULI',
            'TIA' => 'TRIA',
            'IKBAL' => 'IQBAL',
            'NUR CHAFID' => 'CHAFID',
            'W2__TRIA' => 'TRIA',
            'W3__TRIA' => 'TRIA',
        ];
        return $aliases[$normalized] ?? $legacyName;
    }

    private function periodFromPayrollKey(string $key): string
    {
        $parts = explode('__', $key, 2);
        return $parts[0] ?? '';
    }

    private function advanceEntryType(string $value): string
    {
        $value = strtoupper(trim($value));
        if (in_array($value, ['LUNAS', 'BAYAR', 'PELUNASAN', 'SETTLEMENT'], true)) {
            return 'SETTLEMENT';
        }
        if (in_array($value, ['REVERSAL', 'BATAL', 'REOPEN'], true)) {
            return 'REVERSAL';
        }
        return 'TAKE';
    }

    private function loanMovementType(string $value): string
    {
        $value = strtoupper(trim($value));
        if (strpos($value, 'BAYAR') !== false || strpos($value, 'CICIL') !== false || strpos($value, 'LUNAS') !== false) {
            return 'INSTALLMENT';
        }
        if (strpos($value, 'BATAL') !== false || strpos($value, 'REVERS') !== false) {
            return 'REVERSAL';
        }
        return 'DISBURSEMENT';
    }

    private function attendanceType(string $value): string
    {
        $value = strtoupper(trim($value));
        $allowed = ['HADIR', 'IZIN', 'SAKIT', 'TIDAK_MASUK', 'CUTI', 'DINAS', 'SETENGAH_HARI', 'LIBUR', 'LEMBUR'];
        if (!in_array($value, $allowed, true)) {
            throw new ApiException('Jenis absensi tidak dikenal.', 422, 'HRD_ATTENDANCE_TYPE_INVALID');
        }
        return $value;
    }

    private function employmentStatus(string $value): string
    {
        $value = strtoupper(trim($value));
        if (in_array($value, ['INACTIVE', 'NONAKTIF', 'NON-AKTIF', 'STOP'], true)) {
            return 'INACTIVE';
        }
        if (in_array($value, ['ENDING', 'BERAKHIR', 'AKAN_BERHENTI'], true)) {
            return 'ENDING';
        }
        return 'ACTIVE';
    }

    private function salaryMode(string $value): string
    {
        $value = strtoupper(trim($value));
        return in_array($value, ['HARIAN', 'DAILY'], true) ? 'HARIAN' : 'BULANAN';
    }

    private function payrollDay($value): int
    {
        $day = (int)$value;
        if ($day < 1 || $day > 31) {
            return 28;
        }
        return $day;
    }

    private function employeeCode(string $employeeId, string $name): string
    {
        $slug = strtoupper(preg_replace('/[^A-Z0-9]+/', '', $this->normalizeName($name)) ?? 'EMP');
        $slug = substr($slug, 0, 12);
        return substr($slug . '-' . substr(hash('sha256', $employeeId), 0, 8), 0, 50);
    }

    private function requiredIdentifier(string $value, string $label): string
    {
        $value = strtoupper(trim($value));
        if ($value === '' || !preg_match('/^[A-Z0-9_-]{3,50}$/', $value)) {
            throw new ApiException($label . ' tidak valid.', 422, 'HRD_IDENTIFIER_INVALID');
        }
        return $value;
    }

    private function requiredText(string $value, int $max, string $label): string
    {
        $value = $this->text($value, $max);
        if ($value === '') {
            throw new ApiException($label . ' wajib diisi.', 422, 'HRD_REQUIRED_FIELD');
        }
        return $value;
    }

    private function text(string $value, int $max): string
    {
        return mb_substr(trim($value), 0, $max);
    }

    private function nullableText(string $value, int $max): ?string
    {
        $value = $this->text($value, $max);
        return $value === '' ? null : $value;
    }

    private function normalizeName(string $value): string
    {
        $value = mb_strtoupper(trim($value));
        $value = preg_replace('/\s+/', ' ', $value) ?? $value;
        return $value;
    }

    private function decimal($value): float
    {
        if (is_string($value)) {
            $value = preg_replace('/[^0-9.-]/', '', $value) ?? '0';
        }
        $number = (float)$value;
        return is_finite($number) ? round($number, 4) : 0.0;
    }

    private function money($value): float
    {
        return round(max(0, $this->decimal($value)), 2);
    }

    private function positiveMoney($value, string $label): float
    {
        $amount = $this->money($value);
        if ($amount <= 0) {
            throw new ApiException($label . ' harus lebih dari nol.', 422, 'HRD_AMOUNT_INVALID');
        }
        return $amount;
    }

    private function periodOrDefault(string $value, string $default): string
    {
        $value = trim($value);
        return preg_match('/^\d{4}-\d{2}$/', $value) ? $value : $default;
    }

    private function validPeriodOrNull(string $value): ?string
    {
        $value = trim($value);
        return preg_match('/^\d{4}-\d{2}$/', $value) ? $value : null;
    }

    private function dateOrDefault(string $value, string $default): string
    {
        $value = trim($value);
        if ($value === '') {
            return $default;
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) {
            throw new ApiException('Format tanggal harus YYYY-MM-DD.', 422, 'HRD_DATE_INVALID');
        }
        return $value;
    }

    private function validDateOrNull(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return $date && $date->format('Y-m-d') === $value ? $value : null;
    }

    private function isoDateTimeToMysql(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        try {
            return (new DateTimeImmutable($value))->format('Y-m-d H:i:s');
        } catch (Throwable) {
            return null;
        }
    }

    private function encodeJson($value): string
    {
        $json = json_encode(
            $value,
            JSON_UNESCAPED_UNICODE
            | JSON_UNESCAPED_SLASHES
            | JSON_INVALID_UTF8_SUBSTITUTE
        );
        if (!is_string($json)) {
            throw new ApiException('Data JSON HRD gagal dibentuk.', 500, 'HRD_JSON_ENCODE_FAILED');
        }
        return $json;
    }

    private function inClause(array $values): array
    {
        $values = array_values(array_filter(array_map('strval', $values), static function (string $value): bool { return $value !== ''; }));
        if ($values === []) {
            return ['NULL', []];
        }
        return [implode(',', array_fill(0, count($values), '?')), $values];
    }
}
