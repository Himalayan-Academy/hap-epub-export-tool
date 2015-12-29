var EPub = require("epub");
var async = require("async");
var handlebars = require("handlebars");
var fs = require('node-fs-extra');
var AdmZip = require('adm-zip');
var path = require('path');


var epubfile = "what-is-hinduism.epub";

fs.removeSync("web");

fs.mkdirsSync("web/styles");
fs.mkdirsSync("web/images");

function extractResources() {
    // reading archives 
    var zip = new AdmZip(epubfile);
    var zipEntries = zip.getEntries(); // an array of ZipEntry records 
 
    console.log("extracting resources...")
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

        console.log(zipEntry.name); // outputs zip entries information 
    });
}


function extractChapters(epub) {
    
    var templateContent = fs.readFileSync("template.hbs");
    var template = handlebars.compile(templateContent.toString());
    
    console.log("--- getting chapters ---");

    epub.flow.forEach(function (chapter) {
        console.log(chapter.id);

        var file = "web/" + chapter.id + ".html";

        epub.getChapter(chapter.id, function (err, text) {
            
            text = text.replace(/"\.\.\//g, "\"");
            
            var output = template({chapterContent: text});

            if (err) {
                console.error(err);
                throw (err);
            } else {
                fs.outputFileSync(file, output);
            }

        }, true);
    });
}

// Step #1 - open epub

function processEpubContent() {
    
    
    var epub = new EPub(epubfile, "/images/", "/xhtml/");

    epub.on("end", function () {
        // epub is now usable
        console.log(epub.metadata.title);

        extractChapters(epub);

    });

    epub.parse();
}

extractResources();
processEpubContent();

// Step #2 - copy images and css over to web folder

// Step #3 - process HTML files