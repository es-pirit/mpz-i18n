type RuleOptions = { text: string, background?: string, color?: string, bold?: boolean };

const Frozen = { ROWS: 3, COLS: 6 };

const FIELD_COLS = 3;
const FLAG_ID = "!!";
const RULES = [
    { text: "#", background: "#d9ead3", color: "#38761d", bold: true, note: "忽略與註解 (Be ignored in .json file; Be comment in .ts file)" },
    { text: "!", background: "#fff2cc", color: "#cc0000", bold: true, note: "高亮列位 (Highlight the row)" },
    { text: "\\", background: "#f3f3f3", note: "強制插入新行 (Force to insert new line in .json file)" },
] as Readonly<(RuleOptions & { note: string })[]>;

function createTemplate() {
    const { spreadsheet, ui } = getApp();
    const i18n = getLocale();

    // Get the amount of languages
    const result = ui.prompt(i18n.dialog.numFileds, i18n.dialog.descFileds, ui.ButtonSet.OK_CANCEL);
    if (result.getSelectedButton() !== ui.Button.OK) return;

    const response = result.getResponseText() || "1";
    const fields = isNaN(+response) ? response.split(",").map(v => v.trim()) : new Array(Math.max(+response, 0)).fill("");

    // Create a sheet
    const sheet = spreadsheet.insertSheet(`Translate${ spreadsheet.getSheetByName("Translate") ? ` ${ spreadsheet.getSheets().length }` : "" }`);
    const validation = SpreadsheetApp.newDataValidation()
        .requireValueInList(RULES.map(v => v.text), false).setAllowInvalid(true)
        .build();

    sheet.deleteColumns(Frozen.COLS + 2, sheet.getMaxColumns() - Frozen.COLS - 1);
    sheet.setColumnWidth(1, 45);
    sheet.setColumnWidths(2, Frozen.COLS - 2, 30);
    sheet.setColumnWidths(Frozen.COLS, sheet.getMaxColumns() - Frozen.COLS + 1, 90);
    sheet.setFrozenColumns(Frozen.COLS);
    sheet.setFrozenRows(Frozen.ROWS);

    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setFontFamily("Trebuchet MS").setVerticalAlignment("middle").setNumberFormat("@");
    sheet.getRange(1, 1, Frozen.ROWS, Frozen.COLS).setBackground("#d9d9d9").setFontWeight("bold").setHorizontalAlignment("center");
    sheet.getRange(1, 2, Frozen.ROWS, Frozen.COLS - 1).mergeAcross();
    sheet.getRange(3, 1).setValue(FLAG_ID).setNote("可用的旗標 (Available Flags):\n\n" + RULES.map(v => `[ ${ v.text } ] ${ v.note }`).join("\n\n"));
    sheet.getRange(3, 2).setRichTextValue(getRichText("語系設定參數 [Config]", false));
    sheet.getRange(Frozen.ROWS + 1, 1, sheet.getMaxRows() - Frozen.ROWS, 1).setHorizontalAlignment("center").setDataValidation(validation);

    // Set the conditional format rules
    const range = sheet.getRange(Frozen.ROWS + 1, 1, sheet.getMaxRows() - Frozen.ROWS, sheet.getMaxColumns());
    const buildRule = ({ text, background, color, bold }: RuleOptions) => {
        return SpreadsheetApp.newConditionalFormatRule()
            .whenFormulaSatisfied(text)
            .setBackground(background || null).setFontColor(color || null).setBold(bold || null).setRanges([range])
            .build();
    };
    sheet.setConditionalFormatRules(RULES.flatMap(v => {
        const { text, background, color, bold } = v;
        return [
            buildRule({ text: `=AND(ISFORMULA(A4), $A4="${ text }")`, background, color: "#3c78d8", bold }),
            buildRule({ text: `=$A4="${ text }"`, background, color, bold }),
        ];
    }).concat(buildRule({ text: `=ISFORMULA(A4)`, color: "#3c78d8" })));

    SpreadsheetApp.flush();
    SpreadsheetApp.setActiveSheet(sheet);

    // Create fields for each language
    for (let i = 0, len = fields.length; i < len; i++)
        insertField(Frozen.COLS + FIELD_COLS * i + 1, fields[i], i === 0);

    log(Strings.format(i18n.dialog.done, i18n.menu.template));
}

function createField() {
    const i18n = getLocale();

    insertField();
    log(Strings.format(i18n.dialog.done, i18n.menu.field));
}

function insertField(column?: number, code = "", main = false) {
    const { sheet } = getApp();
    column ||= sheet.getLastColumn() + 1;

    sheet.insertColumns(column, FIELD_COLS);
    sheet.getRange(1, column, Frozen.ROWS, sheet.getMaxColumns() - column + 1).setBackground("#efefef");
    sheet.getRange(1, column, 2, sheet.getMaxColumns() - column + 1).setHorizontalAlignment("center");
    sheet.getRange(1, column, 1, sheet.getMaxColumns() - column + 1).setFontWeight("bold");
    sheet.getRange(1, column, sheet.getMaxRows(), sheet.getMaxColumns() - column + 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    sheet.getRange(3, column, 1, FIELD_COLS).mergeAcross();

    sheet.getRange(1, column).setRichTextValue(getRichText("語系代碼 [Code]"));
    sheet.getRange(1, column + 1).setRichTextValue(getRichText("語系名稱 [Name]"));
    sheet.getRange(1, column + 2).setRichTextValue(getRichText("啟用輸出 [Exportable]"));
    sheet.getRange(2, column).setValue(code).setNote("可用的格式 (Available Format):\n\n[ code ]: 檔名兼語系代碼 (Be both the file name and language code, e.g. zh or en-US)\n\n[ name:code ]: 區分檔名與語系代碼 (The former one is for file name, and the another is for language code, e.g. zhc:zh-CN)");
    sheet.getRange(2, column + 2).setValue("True").setDataValidation(
        SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build()
    );
    sheet.getRange(Frozen.ROWS, column).setValue("loading=\nfontSize=");
    sheet.getRange(Frozen.ROWS + 1, column, sheet.getMaxRows() - Frozen.ROWS, FIELD_COLS).mergeAcross();

    // Set google translation
    if (!main) {
        const range = sheet.getRange(2, column).getA1Notation().replace(/([A-Z]+)(\d+)/g, "$$$1$$$2");
        const source = `IF(ISERR(FIND(":", $G$2)), $G$2, INDEX(SPLIT($G$2, ":"), 0, 2))`;
        const target = `IF(ISERR(FIND(":", ${ range })), ${ range }, INDEX(SPLIT(${ range }, ":"), 0, 2))`;
        const formula = `=IF(OR(ISBLANK($G4), ISBLANK($G$2), ISBLANK(${ range })), "", GOOGLETRANSLATE($G4, ${ source }, ${ target }))`;
        sheet.getRange(Frozen.ROWS + 1, column, sheet.getMaxRows() - Frozen.ROWS, 1).setFormula(formula);
    }
    SpreadsheetApp.flush();
}
