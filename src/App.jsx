function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Tambahan 'purchases' untuk fitur Pembelian & Hutang Pusat
  var sheets = ['orders', 'expenses', 'payments', 'pemalang', 'stok', 'purchases'];
  sheets.forEach(function(name) {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name); 
    }
  });
}

function doGet(e) {
  setupSheets();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var combinedData = []; 
  var sheets = ['orders', 'expenses', 'payments', 'pemalang', 'stok', 'purchases'];

  sheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    var data = sheet.getDataRange().getValues();
    if (data.length > 1) {
      var headers = data[0];
      for (var i = 1; i < data.length; i++) {
        var obj = {};
        for (var j = 0; j < headers.length; j++) {
          obj[headers[j]] = data[i][j];
        }
        obj.table = name;
        if (obj.isDeleted !== true && obj.isDeleted !== 'true' && obj.isDeleted !== 'TRUE') {
          combinedData.push(obj);
        }
      }
    }
  });

  var result = { status: 'success', data: combinedData };
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  setupSheets();
  var payload = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(payload.table);

  if (payload.action === 'insert') {
    var dataObj = payload.data;
    dataObj.isDeleted = false; 
    dataObj.timestamp = new Date().toISOString();

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];

    if (headers.length === 0 || headers[0] === "") {
      headers = Object.keys(dataObj);
      sheet.appendRow(headers);
    } else {
      var currentKeys = Object.keys(dataObj);
      for (var k = 0; k < currentKeys.length; k++) {
        if (headers.indexOf(currentKeys[k]) === -1) {
          headers.push(currentKeys[k]);
          sheet.getRange(1, headers.length).setValue(currentKeys[k]);
        }
      }
    }
    var row = [];
    headers.forEach(function(header) {
      row.push(dataObj[header] !== undefined ? dataObj[header] : "");
    });
    sheet.appendRow(row);

  } else if (payload.action === 'delete') {
    // FIX BUG PENGHAPUSAN: Ubah payload.id menjadi payload.data.id
    var idToDelete = payload.data.id; 
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idIndex = headers.indexOf('id');
    var isDeletedIndex = headers.indexOf('isDeleted');

    if (isDeletedIndex === -1) {
      isDeletedIndex = headers.length;
      sheet.getRange(1, isDeletedIndex + 1).setValue('isDeleted');
    }
    if (idIndex > -1) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][idIndex] === idToDelete) {
          sheet.getRange(i + 1, isDeletedIndex + 1).setValue(true);
          break;
        }
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
}
