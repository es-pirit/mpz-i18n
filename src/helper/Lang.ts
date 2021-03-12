const zh = {
    menu: {
        scripts: "指令碼",
        title: "語系建置器",
        template: "新建語系模板",
        field: "新增語系欄位",
        export: "輸出文件",
        token: "取得 Token",
    },
    dialog: {
        numFileds: "請輸入語系「數量」或「代碼」：",
        descFileds: "語系數量，如：3 (表示建立 3 個語系)\n語系代碼，如：zh,en,ja (以逗號「,」隔開，表示建立 3 個語系)",
        done: "完成任務：「{0}」",
        export: "輸出語系文件",
    },
    form: {
        submit: "建置",
        download: "下載",
    },
};

const en = {
    menu: {
        scripts: "Scripts",
        title: "Translation Builder",
        template: "Create a template",
        field: "Insert a field",
        export: "Export files",
        token: "Get the Token",
    },
    dialog: {
        numFileds: `Enter "the amount" or "the codes" of language:`,
        descFileds: `The amount of language, e.g. 3 (means building 3 languages)\nThe codes of languages, e.g. zh,en,ja (with commas ","; means building 3 languages)`,
        done: `Done the task: "{0}"`,
        export: "Export Files of Languages",
    },
    form: {
        submit: "Build",
        download: "Download",
    },
};

function getLocale() {
    const locale = Session.getActiveUserLocale();
    return {
        locale,
        ...readonly(locale.indexOf("zh") === 0 ? zh : en, true),
    };
}
