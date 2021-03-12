const { spawn } = require("child_process");
const exec = commands => spawn(commands, { stdio: "inherit", shell: true });

const axios = require("axios");
const chalk = require("chalk");
const path = require("path");
const fse = require("fs-extra");

const spreadsheet = "https://docs.google.com/spreadsheets/d/1e0_8gSSO8t_bIiu-sb__Cxjtg-vi153kGh43-6bbOVM";
const script = "https://script.google.com/a/macros/w-techsolutions.com/s/AKfycbxTMQvCO5TWCzhQXk2N-Z3ATW15zVeKimZLMaBJ68bkNwSXZATSs97RwoedOibi_GfS/exec";
let [,, token] = process.argv;

(async function run() {
    if (token === "open") {
        exec(`opener "${ spreadsheet }"`);
        return;
    }

    const request = {
        json: { indexable: true, formattable: true },
        ts: { exportable: true, indexable: false, extension: "@/utils/langs/BaseLangFile" },
        sheets: [
            { name: "roots", enabled: true, main: true, type: false },
            { name: "tags:Mobile", enabled: true, main: false, type: true },
            { name: "tags:Bet", enabled: true, main: false, type: true },
        ],
    };

    let data;
    try {
        console.log(chalk.cyan("Please wait for fetching the data from google..."));
        data = (await axios.post(script, request, { headers: { Authorization: `Bearer ${ token }` } })).data;
    }
    catch {
        console.log(chalk.red("Token Error: Please re-get the token!"));
        console.log(`1. Please open the spreadsheet: ${ chalk.yellow("npm run translate open") } or ${ chalk.blue(spreadsheet) }.`);
        console.log(`2. Click ${ chalk.yellow("[Scripts] > [Get the token]") }.`);
        console.log();
    }

    const input = path.resolve(__dirname, "..");
    const output = path.resolve(__dirname, "../../..");

    console.log(chalk.cyan("Start to save the files..."));

    fse.writeFileSync(path.resolve(input, "bin/res/langs/outline.json"), data.output, { overwrite: true });
    fse.writeFileSync(path.resolve(input, "src/models/vo/LangFile.ts"), data.type, { overwrite: true });
    Object.entries(data.langs).forEach(([code, content]) => {
        fse.writeFileSync(path.resolve(input, `bin/res/langs/${ code }.json`), content, { overwrite: true });
    });

    fse.copySync(path.resolve(input, "bin/res/langs"), path.resolve(output, "bin/res/langs"), { overwrite: true });

    console.log(chalk.green("Done!"));
    console.log();
})();
