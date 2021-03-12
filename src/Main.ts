import Events = GoogleAppsScript.Events;

function onOpen(e: Events.SheetsOnOpen) {
    const ui = SpreadsheetApp.getUi();
    const i18n = getLocale();

    ui.createMenu(i18n.menu.scripts)
        .addSubMenu(
            ui.createMenu(i18n.menu.title)
                .addItem(i18n.menu.template, "createTemplate")
                .addItem(i18n.menu.field, "createField")
                .addSeparator()
                .addItem(i18n.menu.export, "openExportDialog")
        )
        .addItem(i18n.menu.token, "getAuth")
        .addToUi();
}

function getAuth() {
    log(ScriptApp.getOAuthToken(), LogLevel.Info, LogMode.Alert);
}

function doPost(e: Events.DoPost) {
    const data = fetchFiles(JSON.parse(e.postData.contents));

    //NOTE 輸出網頁內容 return HtmlService.createTemplateFromFile()
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
