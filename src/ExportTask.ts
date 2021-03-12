type BasicSheetInfo = { enabled: boolean, name: string, main: boolean, type: boolean };
type SheetInfo = BasicSheetInfo & { sheet: GoogleAppsScript.Spreadsheet.Sheet };
type ExportOptions = {
    json: { indexable: boolean, formattable: boolean },
    ts: { exportable: boolean, indexable: boolean, extension: string },
    sheets: BasicSheetInfo[],
}

function openExportDialog() {
    const i18n = getLocale();
    const sheets = getApp().spreadsheet.getSheets()
        .filter(v => v.getRange(Frozen.ROWS, 1).getValue() === FLAG_ID)
        .map(v => v.getSheetName());
    const html = Object.assign(HtmlService.createTemplateFromFile("src/ui/export"), {
        i18n, sheets,
    });
    SpreadsheetApp.getUi().showSidebar(html.evaluate().setTitle(i18n.dialog.export));
}

function exportFiles(options: ExportOptions) {
    const app = getApp();
    const main = app.spreadsheet.getSheetByName(options.sheets.find(v => v.main)!.name)!;
    const sheets = options.sheets.filter(v => v.enabled).map(v => Object.assign(v, { sheet: app.spreadsheet.getSheetByName(v.name)! }));
    const outline = getOutlineFile(main, options.json.formattable);
    const total = 3 + sheets.length + (+options.ts.exportable);
    const name = app.spreadsheet.getName();

    // Get the folder where the spreadsheet saved or the root of the drive
    const folders = DriveApp.getFileById(app.spreadsheet.getId()).getParents();
    const folder = (folders.hasNext() ? folders.next() : DriveApp.getRootFolder())
        .createFolder(`${ name }_${ Utilities.formatDate(new Date(), app.spreadsheet.getSpreadsheetTimeZone(), "yy-MM-dd\'T\'HH:mm:ss") }`);
    const files = [] as GoogleAppsScript.Drive.File[];

    // Export the files
    //@ts-ignore
    files.push(folder.createFile("outline.json", outline.file, MimeType.PLAIN_TEXT));
    log(`進度：1 / ${ total } (輸出: outline.json)`, LogLevel.Info);

    const langs = sheets.reduce((p, sheet, i) => {
        const files = getLangFiles(sheet, outline.info);

        options.json.indexable ?
            Object.entries(files).forEach(([code, file]) => Objects.cover(p[code] ||= {}, { [sheet.name.split(":")[0]]: file })) :
            Objects.cover(p, files);

        log(`進度：${ 2 + i } / ${ total } (解析: 資料表 ${ sheet.name })`, LogLevel.Info);
        return p;
    }, {} as Dict);

    Object.entries(langs).forEach(([code, file], i, arr) => {
        const name = `${ code }.json`;
        //@ts-ignore
        files.push(folder.createFile(name, toJSON(file, options.json.formattable), MimeType.PLAIN_TEXT));
        log(`進度：${ 1 + sheets.length + +((i + 1) / arr.length).toFixed(2) } / ${ total } (輸出: ${ name })`, LogLevel.Info);
    });

    if (options.ts.exportable) {
        //@ts-ignore
        files.push(folder.createFile("LangFile.ts", getTypeFile(sheets, Object.keys(outline.info), options.ts.indexable, options.ts.extension), MimeType.PLAIN_TEXT));
        log(`進度：${ total - 1 } / ${ total } (輸出: LangFile.ts)`, LogLevel.Info);
    }

    const zip = folder.createFile(Utilities.zip(files, app.spreadsheet.getName()));
    log(`進度：${ total } / ${ total } (輸出: ${ name }.zip)`, LogLevel.Info);

    return { message: `已輸出至資料夾「${ folder.getName() }」或請點擊「下載」`, download: zip.getDownloadUrl() };
}

function fetchFiles(options: ExportOptions) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const main = spreadsheet.getSheetByName(options.sheets.find(v => v.main)!.name)!;
    const sheets = options.sheets.filter(v => v.enabled).map(v => Object.assign(v, { sheet: spreadsheet.getSheetByName(v.name)! }));
    const outline = getOutlineFile(main, options.json.formattable);
    const langs = sheets.reduce((p, sheet, i) => {
        const files = getLangFiles(sheet, outline.info);

        options.json.indexable ?
            Object.entries(files).forEach(([code, file]) => Objects.cover(p[code] ||= {}, { [sheet.name.split(":")[0]]: file })) :
            Objects.cover(p, files);
        return p;
    }, {} as Dict);
    const type = options.ts.exportable ? getTypeFile(sheets, Object.keys(outline.info), options.ts.indexable, options.ts.extension) : null;

    return {
        outline: outline.file,
        langs: Object.entries(langs).reduce((p, [code, file]) => Object.assign(p, { [code]: toJSON(file, options.json.formattable) }), {} as Dict),
        type,
    }
}

// #[Getters] ----------- + ----------- + ----------- + ----------- + -----------
/** Get the content of the outline file */
function getOutlineFile(sheet: GoogleAppsScript.Spreadsheet.Sheet, formattable: boolean) {
    const info = {} as Dict<number>;
    const file = new Array<null>((sheet.getMaxColumns() - Frozen.COLS) / FIELD_COLS >> 0).fill(null).reduce((p, v, i) => {
        const enable = sheet.getRange(2, Frozen.COLS + i * FIELD_COLS + 3).getValue() as boolean;
        const code = (sheet.getRange(2, Frozen.COLS + i * FIELD_COLS + 1).getValue() as string).split(":")[0];

        if (enable) {
            info[code] = i;
            return Object.assign(p, {
                [code]: {
                    name: sheet.getRange(2, Frozen.COLS + i * FIELD_COLS + 2).getValue() as string,
                    config: (sheet.getRange(3, Frozen.COLS + i * FIELD_COLS + 1).getValue() as string).split("\n").reduce((p, v) => {
                        const [key, value] = v.split("=");
                        return Object.assign(p, { [key]: value });
                    }, {} as Dict<string>),
                },
            });
        }
        else return p;
    }, {} as Dict<{ name: string, config: Dict<string> }>);

    return { info, file: toJSON(file, formattable) };
}

/** Get the content of the language files for the specific sheet */
function getLangFiles({ sheet }: SheetInfo, info: Dict<number>) {
    const codes = Object.entries(info) as [code: string, index: number][];
    const keys = sheet.getRange(Frozen.ROWS + 1, 1, sheet.getLastRow() - Frozen.ROWS, Frozen.COLS).getValues() as Index[][];
    const values = sheet.getRange(Frozen.ROWS + 1, Frozen.COLS + 1, sheet.getLastRow() - Frozen.ROWS, Math.max(...codes.map(([, index]) => index)) * FIELD_COLS + 1).getValues() as string[][];

    const result = codes.reduce((p, [code]) => Object.assign(p, { [code]: {} }), {} as Dict);
    const stack = [] as Index[];

    const setValue = (key: Index, values: string[]) => {
        codes.forEach(([code, index]) => {
            stack.reduce((p, v) => p[v], result[code])[key] = values[index * FIELD_COLS];
        });
    };

    keys.forEach((item, row) => {
        const target = parse(item);
        if (!target || target.index < 0) return;

        let next: ReturnType<typeof parse>;
        let nextRow = +row;
        while (!next && nextRow < keys.length)
            next = parse(keys[++nextRow]);

        if (next) {
            if (next.index < target.index) {
                setValue(target.key, values[row]);
                stack.splice(next.index);
                return;
            }
            else if (next.index === target.index + 1) {
                const isString = (typeof next.key === "string");
                codes.forEach(([code]) => {
                    stack.reduce((p, v) => p[v], result[code])[target.key] = isString ? {} : [];
                });
                stack.push(target.key);
                return;
            }
            else if (next.index > target.index) {
                sheet.getRange(Frozen.ROWS + nextRow + 1, 1).setValue("!");
                SpreadsheetApp.flush();
                throw new Error(`格式錯誤：資料表 ${ sheet.getName() }，行 ${ Frozen.ROWS + nextRow + 1 } 的階層位置僅能高過於行 ${ Frozen.ROWS + (+row) + 1 } 的 1 層`);
            }
        }
        setValue(target.key, values[row]);
    });
    return result;
}

/** Get the content of Typescript file */
function getTypeFile(sheets: SheetInfo[], codes: string[], indexable: boolean, extension: string) {
    const result = {} as Dict;
    const stack = [] as Index[];
    const aliases = {} as Dict<(string | undefined)[]>;

    const to = (key: Index) => (typeof key === "string" ? `.${ key }` : `[${ key }]`);
    const setValue = (key: Index, alias?: string) => {
        const value = stack.reduce((p, v, i) => `${ p }${ i ? to(v) : v }`, "");
        if (alias && typeof key === "number")
            (aliases[value] ||= [])[key] = alias;

        stack.reduce((p, v) => p[v], result)[key] = value + to(key);
    };

    sheets.filter(v => v.type).forEach(({ name, sheet }) => {
        stack.length = 0;
        if (indexable) {
            const n = name.split(":")[0];
            result[n] ||= {};
            stack.push(n);
        }

        const keys = sheet.getRange(Frozen.ROWS + 1, 1, sheet.getLastRow() - Frozen.ROWS, Frozen.COLS).getValues() as Index[][];

        keys.forEach((item, row) => {
            const target = parse(item);
            if (!target || target.index < 0) return;

            let next: ReturnType<typeof parse>;
            let nextRow = +row;
            while (!next && nextRow < keys.length)
                next = parse(keys[++nextRow]);

            if (next) {
                if (next.index < target.index) {
                    setValue(target.key, target.alias);
                    stack.splice(+indexable + next.index);
                    return;
                }
                else if (next.index === target.index + 1) {
                    const isString = (typeof next.key === "string");
                    stack.reduce((p, v) => p[v], result)[target.key] = isString ? {} : [];
                    stack.push(target.key);
                    return;
                }
                else if (next.index > target.index) return;
            }
            setValue(target.key, target.alias);
        });
    });

    const clazz = extension.split(/\\|\/|\./g).pop();
    let content = `import ${ clazz } from \"${ extension }\";\n\n`
        + `export enum LangCode { ${ codes.join(", ") } }\n`
        + `export type LangCodeKeys = keyof typeof LangCode;\n\n`
        + `export default class LangFile extends ${ clazz }\n`
        + toJSON(result, true).replace(/(\n\s{4})"(\w+)":/g, "$1$2 =").replace(/(\n\s{4}[}\]]),/g, "$1;").replace(/"(\w+)":/g, "$1:");
    Object.entries(aliases).forEach(([key, alias]) => {
        content = content.replace(new RegExp(`(${ key }\\[[^,]*?\\])(,?\n)`), "$1 as [" + alias.map((v, i) => (v || `value${ i }`) + ": string").join(", ") + "]$2");
    });

    return content;
}

// #[Utilities] ----------- + ----------- + ----------- + ----------- + -----------
function parse(item = [] as Index[]) {
    for (const [col, key] of Object.entries(item)) {
        if (col === "0") {
            if (key === "#") return { index: -1, key };
        }
        else if (key) {
            const [k, alias] = `${ key }`.split(":");
            return { index: +col - 1, key: isNaN(+k) ? k : +k, alias };
        }
    }
};
