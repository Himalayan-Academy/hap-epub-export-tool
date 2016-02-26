#!/usr/bin/env node
var EPub = require("epub");
var async = require("async");
var handlebars = require("handlebars");
var fs = require('node-fs-extra');
var AdmZip = require('adm-zip');
var path = require('path');
var _ = require("lodash");
var program = require('commander');
var chalk = require('chalk');

function copyOverrideFiles() {
    console.log(chalk.bold.green("removing old folder..."));
    fs.removeSync("web");

    console.log(chalk.bold.green("creating folder structure and copying basic files..."));
    fs.mkdirsSync("web/styles");
    fs.mkdirsSync("web/images");
    fs.copySync("index.html", "web/index.html");
    fs.copySync("_style.css", "web/styles/_style.css");
    fs.copySync("bootstrap.css", "web/styles/bootstrap.css");

}

function extractResources(epubfile) {
    // reading archives 
    var zip = new AdmZip(epubfile);
    var zipEntries = zip.getEntries(); // an array of ZipEntry records

    copyOverrideFiles();


    console.log(chalk.bold.cyan("extracting resources..."));
    zipEntries.forEach(function (zipEntry) {

        var extension = path.extname(zipEntry.name);
        var outputPath;

        switch (extension) {
            case ".css":
                outputPath = "web/styles/";
                break;

            case ".jpg":
            case ".png":
                outputPath = "web/images/";
                break;

            default:
                return;
                break;
        }

        zip.extractEntryTo(zipEntry.entryName, outputPath, false, true);

        console.log(chalk.bold.cyan("extracting: ") + zipEntry.name); // outputs zip entries information
    });
}


function extractChapters(epub) {
    
    var templateContent = fs.readFileSync("template.hbs");
    var template = handlebars.compile(templateContent.toString());
    
    console.log(chalk.bold.blue("Extracting chapters..."));

    epub.flow.forEach(function (chapter) {
        console.log(chalk.bold.cyan("extracting: ") + chapter.id);

        var file = "web/" + chapter.id + ".html";

        var data = {
            meta: epub.metadata,
            previous: false,
            next: false
        };

        // find previous and next links

        var previousTocItem = _.find(epub.toc, function(o){
            return o.order == chapter.order - 1;
        });

        var nextTocItem = _.find(epub.toc, function(o){
            return o.order == chapter.order + 1;
        });

        if (previousTocItem) {
            data.previous = path.basename(previousTocItem.href);
        }

        if (nextTocItem) {
            data.next = path.basename(nextTocItem.href);
        }


        epub.getChapter(chapter.id, function (err, text) {
            
            text = text.replace(/"\.\.\//g, "\"");

            text = text.replace(/illustration hundreds/g, "illustration hundred");


            data.chapterContent = text;
            data.chapter = chapter;

            var output = template(data);


            if (err) {
                console.error(chalk.bold.red("ERROR: ") +err);
                throw (err);
            } else {
                fs.outputFileSync(file, output);
            }
            


        }, true);
    });
    console.log(chalk.bold.green("Done!"));

}

// Step #1 - open epub
// TODO: tornar responsivo, colocar js de navegacao no mobile.

function processEpubContent(epubfile) {
    
    
    var epub = new EPub(epubfile, "/images/", "/xhtml/");

    epub.on("end", function () {
        // epub is now usable
        console.log(chalk.bold.blue("Title: ") + epub.metadata.title);

        extractChapters(epub);

    });

    epub.parse();
}




program
    .version("1.0.0")
    .arguments("<file>")
    .action(function(epubfile){
        console.log(chalk.bold.green("Processing: ") + epubfile);
        extractResources(epubfile);
        processEpubContent(epubfile);
    })
    .parse(process.argv);
