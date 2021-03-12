function readonly<T extends Dict>(target: T): Readonly<T>;
function readonly<T extends Dict, U extends boolean>(target: T, deep: U): U extends true ? DeepReadonly<T> : Readonly<T>;
function readonly(target: Dict) {
    return target;
}

function getApp() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    return {
        spreadsheet,
        sheet: SpreadsheetApp.getActiveSheet(),
        range: SpreadsheetApp.getActiveRange(),
        ui: SpreadsheetApp.getUi(),
    };
}

function getRichText(value: string, wrap = true) {
    wrap && (value = value.replace(/ *\[/g, "\n["));

    const start = value.indexOf("[");
    const style = SpreadsheetApp.newTextStyle().setFontSize(9).setBold(false).build();
    return SpreadsheetApp.newRichTextValue().setText(value).setTextStyle(start, value.indexOf("]") + 1, style).build();
}

function toJSON(value: Dict, formattable: boolean) {
    if (formattable)
        return JSON.stringify(value, undefined, 4).replace(/".*?",(\s*)/g, (str, p1: string) => str.includes(`": "`) ? str : str.replace(p1, " ")) + "\n";
    else return JSON.stringify(value) + "\n";
}

class Maths {
    /** Clamps the value within the inclusive minimum and maximum bounds */
    static clamp(value: number, min = Number.MIN_VALUE, max = Number.MAX_VALUE) {
        max < min && ([max, min] = [min, max]);
        const mid = min > value ? min : value;
        return mid < max ? mid : max;
    }

    /** Returns a pseudorandom number between minimum and maximum */
    static randomInt(min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, inclusive = true) {
        return Math.floor(Math.random() * (max - min + (inclusive ? 1 : 0)) + min);
    }
}

class Strings {
    /** Format the string by replacing `{n}` with arguments */
    static format(text: string, ...args: Primitive[]) {
        const tags = [...text.matchAll(/\{ *(\d+?) *\}/g)].filter((v, i, arr) => arr.indexOf(v) === i);
        return tags.reduce((p, [match, tag]) => p.replace(match, isNaN(+tag) ? tag : args[+tag].toString()), text);
    }
}

class Objects {
    /** Deeply assign or copy the values of all of the enumerable own properties from one or more source objects to a target object. Returns the target object */
    static cover(target: Dict, ...sources: Dict[]) {
        sources.forEach(v => Object.entries(v).forEach(([k, e]) => {
            if (typeof e === "object" && !Array.isArray(e))
                Objects.cover((typeof target[k] !== "object") ? (target[k] = {}) : target[k], e);
            else target[k] = e;
        }));
        return target;
    }
}

// #[Logger] ---------- + ---------- + ---------- + ---------- + ----------
enum LogLevel { Log = "log", Info = "info", Warn = "warn", Error = "error" }
enum LogMode { UntracedToast, Toast, Alert }

const LOG_ICONS = {
    [LogLevel.Log]: "💬", [LogLevel.Info]: "#️⃣", [LogLevel.Warn]: "⚠️", [LogLevel.Error]: "⛔"
};

function log(msg: any, level = LogLevel.Log, mode = LogMode.UntracedToast) {
    const app = getApp();
    const stack = new Error().stack?.split("at ").splice(2).map(v => v.trim());
    const title = `${ LOG_ICONS[level] } ${ level.toUpperCase() }`;

    if (mode === LogMode.UntracedToast)
        app.spreadsheet?.toast(`${ msg }`, title);
    else if (mode === LogMode.Toast)
        app.spreadsheet?.toast(`${ msg }　[Stack: ${ stack?.[0] }]`, title);
    else app.ui?.alert(title, `${ msg }\n\n[Stack]\n${ stack?.join("\n") }`, app.ui.ButtonSet.OK);

    console[level](msg, `\n\n[Stack]\n${ stack?.join("\n") }`);
}
