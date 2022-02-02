 //node Scrapping.js  --excel=wordcup.csv  --dataDir=worldcup --source="https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results" 

let minimist =require("minimist");
let axios=require("axios");
let jsdom=require("jsdom");
let excel4node=require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");
const { ColorTypes } = require("pdf-lib");
let args = minimist(process.argv);

let responseKaPromise = axios.get(args.source);
responseKaPromise.then(function (response) {
    let html = response.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    let matchScoreDivs = document.querySelectorAll("div.match-score-block");  
    let matches = [];
    for (let i = 0; i < matchScoreDivs.length; i++) {
        let match = {
            t1: "",
            t2: "",
            t1s: "",
            t2s: "",
            result: ""
        }; 
        let teamParas = matchScoreDivs[i].querySelectorAll("div.name-detail > p.name");
        match.t1 = teamParas[0].textContent;
        match.t2 = teamParas[1].textContent;
        let scorespans = matchScoreDivs[i].querySelectorAll("div.score-detail>span.score");
        if (scorespans.length == 2) {
            match.t1s = scorespans[0].textContent;
            match.t2s = scorespans[1].textContent;
        } else if (scorespans.length == 1) {
            match.t1s = scorespans[0].textContent;
            match.t2s = "";
        } else {
            match.t1s = "";
            match.t2s = "";
        }
        let resultSpan = matchScoreDivs[i].querySelector("div.status-text>span");
        match.result = resultSpan.textContent;
        matches.push(match);
    }
    let matchesKaJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchesKaJSON, "utf-8");

    let teams = [];
    for (let i = 0; i < matches.length; i++) {
        pushTeamifNotAlreadyTheir(teams, matches[i].t1);
        pushTeamifNotAlreadyTheir(teams, matches[i].t2);
    }
        for (let i = 0; i < matches.length; i++) {
            pushMatchInAppropriateTeam(teams, matches[i].t1, matches[i].t2,
                matches[i].t1s, matches[i].t2s, matches[i].result);
            
                pushMatchInAppropriateTeam(teams, matches[i].t2, matches[i].t1,
                    matches[i].t2s, matches[i].t1s, matches[i].result);
        }
    let teamsKAJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamsKAJSON, "utf-8");
    prepareExcel(teams, args.excel);
    prepareFoldersAndPdfs(teams, args.dataDir);
})
function prepareFoldersAndPdfs(teams, dataDir) {
    if (fs.existsSync(dataDir) == true) {
        fs.rmdirSync(dataDir, { recursive: true });
        }
        fs.mkdirSync(dataDir);
    for (let i = 0; i < teams.length; i++) {
        let teamFolderName = path.join(dataDir, teams[i].name);
        if (fs.existsSync(teamFolderName) == false) {
            fs.mkdirSync(teamFolderName);
        } else {    
        }
        for (let j = 0; j < teams[i].matches.length; j++){
            let match = teams[i].matches[j];
            createMatchScoreCardPdf(teamFolderName,teams[i].name, match);
        }
    }
}
function createMatchScoreCardPdf(teamFolderName,homeTeam, match) {
    let matchFileName = path.join(teamFolderName, match.vs);
    let templateFileBytes = fs.readFileSync("Template.pdf");
    let pdfDocKAPromise = pdf.PDFDocument.load(templateFileBytes);
    pdfDocKAPromise.then(function (pdfdoc) {
        let page = pdfdoc.getPage(0);
        page.drawText(homeTeam, {
            x: 310,
            y: 664,
            size: 10
        });  
        page.drawText(match.vs, {
            x: 310,
            y: 650,
            size: 10
        });
        page.drawText(match.selfScore, {
            x: 310,
            y: 637,
            size: 10
        });
        page.drawText(match.oppScore, {
            x: 310,
            y: 623,
            size: 10
        });
        page.drawText(match.result, {
            x: 310,
            y: 610,
            size: 10
        });
        let changedBytesKAPromise = pdfdoc.save();
        changedBytesKAPromise.then(function (changedBytes) {
            if (fs.existsSync(matchFileName+".pdf") == true) {
                fs.writeFileSync(matchFileName+"1.pdf", changedBytes);
            } else {
                fs.writeFileSync(matchFileName+".pdf", changedBytes);
            }
            })
    })
    }
function prepareExcel(teams, excelFileName) {
    let wb = new excel4node.Workbook();
    for (let i = 0; i < teams.length; i++){
        let tsheet = wb.addWorksheet(teams[i].name);
        tsheet.cell(1, 1).string("vs");
        tsheet.cell(1, 2).string("Self Score");
        tsheet.cell(1, 3).string("Opp Score");
        tsheet.cell(1, 4).string("Result");

        for (let j = 0; j < teams[i].matches.length; j++){
            tsheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
            tsheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
            tsheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore);
            tsheet.cell(2 + j, 4).string(teams[i].matches[j].result);
        }
   }
    wb.write(excelFileName);
 }
function pushMatchInAppropriateTeam(teams, homeTeam, opteam, homeScore, oppScore, result) {
    let t1idx = -1;
    for (let j = 0; j < teams.length; j++){
        if (teams[j].name == homeTeam) {
            t1idx = j; 
        }
    }
    let team = teams[t1idx];
    team.matches.push({
        vs: opteam,
        selfScore: homeScore,
        oppScore: oppScore,
        result: result
    });
}
function pushTeamifNotAlreadyTheir(teams, teamName) {  
    let t1idx = -1;
    for (let j = 0; j < teams.length; j++){
        if (teams[j].name == teamName) {
            t1idx = j;
        }
    }
    if (t1idx == -1) {
        let team = {
            name: teamName,
            matches:[]
        }
        teams.push(team);
    }
}
//npm init -y
//npm install minimist
//npm install axios
//npm install jsdom
//npm install excel4node
//npm install pdf-lib