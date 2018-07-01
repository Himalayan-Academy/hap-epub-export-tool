#!/usr/bin/env node
var EPub = require("epub");
var async = require("async");
var handlebars = require("handlebars");
var fs = require('node-fs-extra');
var AdmZip = require('adm-zip');
var path = require('path');
var _ = require("lodash");
var commandLineArgs = require('command-line-args');
var chalk = require('chalk');
var child_process = require('child_process');
var cheerio = require('cheerio')
var getJSON = require('get-json')
var helpers = require('handlebars-helpers')({
    handlebars: handlebars
});

var ignored_books = [
    "the-five-states-of-mind_ei"
]

var fileId = "";
var bookpath = "";
var imageQuality = 80;
var itemObj = {};

function logError(lbl, obj) {
    if (obj) {
        console.log(chalk.bold.red(`[${options.fileId}] ${lbl}`, obj))
        fs.appendFileSync("errors.log", `[${options.fileId}] ${lbl}: ${JSON.stringify(obj)}\n`)
    } else {
        console.log(chalk.bold.red(`[${options.fileId}] ${lbl}`))
        fs.appendFileSync("errors.log", `[${options.fileId}] ${lbl}\n`)
    }
    process.exit(0)
}

function getFilesizeInBytes(filename) {
    var stats = fs.statSync(filename)
    var fileSizeInBytes = stats["size"]
    return fileSizeInBytes
}

function fixSVGCovers(text) {
    text = text.replace(/svg:/gi, "");

    return text;
}

function fixLeadingNumbersInTOC(text) {
    for (i = 0; i < 99; i++) {
        let s = i
        if (i < 10) {
            s = "0" + i
        }

        s = `href="${s}_`;

        console.log("replacing", s);

        text = text.replace(s, `href="`);
    }

    return text;
}

function addIDsToParagraphs(text) {
    var $ = cheerio.load(text);
    var paragraphSelectors = ["p.indent", "p.noindent", "p.paraspaceabove", "p.paraspaceabove2", "p.quote", "p.quotexx", "h5.textcenter"];
    var x = 0;

    paragraphSelectors.forEach(function (selector) {
        $(selector).each(function (i, elem) {
            x++;
            $(this).append(`<a class='para-link' id='para-${x}' href='#para-${x}'>&para;</a>`);
        });
    });

    return $.html();
}

function execSync(command) {
    var result = child_process.execSync(command, { encoding: 'utf8' });

    return result;

}

function copyOverrideFiles(path) {
    console.log(chalk.bold.green("removing old folder..."));
    fs.removeSync(path + "/web");

    console.log(chalk.bold.green("creating folder structure and copying basic files..."));
    fs.mkdirsSync(path + "/web/styles");
    fs.mkdirsSync(path + "/web/images");
    fs.mkdirsSync(path + "/web/vendor");
    fs.copySync(__dirname + "/resources/index.html", path + "/web/index.html");
    fs.copySync(__dirname + "/resources/logo.svg", path + "/web/images/logo.svg");
    fs.copySync(__dirname + "/resources/_style.css", path + "/web/styles/_style.css");
    fs.copySync(__dirname + "/resources/foundation-6", path + "/web/vendor/foundation-6");
    fs.copySync(__dirname + "/resources/app.js", path + "/web/vendor/app.js");
    fs.writeFileSync(path + "/web/metadata.json", JSON.stringify(itemObj));

}

function extractResources(epubfile) {
    // reading archives 
    var zip = new AdmZip(epubfile);
    var zipEntries = zip.getEntries(); // an array of ZipEntry records

    console.log(chalk.bold.cyan("extracting resources..."));
    zipEntries.forEach(function (zipEntry) {

        var extension = path.extname(zipEntry.name);
        var outputPath;

        switch (extension) {
            case ".css":
                outputPath = bookpath + "/web/styles/";
                break;

            case ".jpg":
            case ".png":
                outputPath = bookpath + "/web/images/";
                break;

            default:
                return;
        }

        zip.extractEntryTo(zipEntry.entryName, outputPath, false, true);

        console.log(chalk.bold.cyan("extracting: ") + zipEntry.name); // outputs zip entries information

        if (extension == ".jpg") {
            var imageFile = outputPath + path.basename(zipEntry.name);

            var bytes = getFilesizeInBytes(imageFile);
            if (bytes > 130000) {
                var imagemagickcommand = "/usr/local/Cellar/imagemagick/6.9.3-7/bin/convert";
                var mozjpegcommand = "/usr/local/Cellar/mozjpeg/3.1/bin/cjpeg";
                if (fs.existsSync(imagemagickcommand) && fs.existsSync(mozjpegcommand)) {
                    // todo: this is not cross-platform.
                    // 
                    // requirements to run: imagemagic convert command and mozjpeg.
                    //
                    console.log(chalk.bold.cyan("Processing image... (size: " + bytes + " bytes)"));
                    var command = "/usr/local/Cellar/imagemagick/6.9.3-7/bin/convert \"" + imageFile + "\" pnm:- | /usr/local/Cellar/mozjpeg/3.1/bin/cjpeg -quality " + imageQuality + "  > '" + imageFile + "_proc' && rm \"" + imageFile + "\" && mv \"" + imageFile + "_proc\" " + "\"" + imageFile + "\"";

                    console.log(command);

                    var result = execSync(command);

                    console.log(result);
                }
            }
        }

    });
}


function extractChapters(epub) {

    var template = __dirname + "/resources/template.hbs";
    var templateContent = fs.readFileSync(template);
    var template = handlebars.compile(templateContent.toString());


    console.log(chalk.bold.blue("Extracting chapters..."));

    epub.flow.forEach(function (chapter) {
        console.log(chalk.bold.cyan("extracting: ") + chapter.id);

        var file = bookpath + "/web/" + chapter.id + ".html";

        var data = {
            chapter: chapter,
            meta: epub.metadata,
            item: itemObj,
            file_id: fileId,
            toc: epub.toc,
            previous: false,
            next: false
        };


        // find previous and next links

        var previousTocItem = _.find(epub.toc, function (o) {
            var match = o.order == chapter.order - 1;
            return match;
        });

        var nextTocItem = _.find(epub.toc, function (o) {
            return o.order == chapter.order + 1;
        });

        var currentSpineItem = _.findIndex(epub.flow, function (o) {
            if (o.href == chapter.href) {
                return true;
            } else {
                return false;
            }

        });

        console.log("current spine item: " + currentSpineItem)

        var previousSpineItem = epub.flow[currentSpineItem - 1] || false;
        var nextSpineItem = epub.flow[currentSpineItem + 1] || false;


        if (previousSpineItem) {
            data.previous = previousSpineItem.id + ".html";
        } else {
            data.previous = false;
        }

        if (nextSpineItem) {
            data.next = nextSpineItem.id + ".html";
        } else {
            data.next = false;
        }



        epub.getChapter(chapter.id, function (err, text) {

            text = text.replace(/"\.\.\//g, "\"");

            text = text.replace(/illustration hundreds/g, "illustration hundred");

            // AAG: Todo, add span tags in paragraphs

            text = addIDsToParagraphs(text);

            // Fix SVG covers
            text = fixSVGCovers(text);


            data.chapterContent = text;
            data.chapter = chapter;

            var output = template(data);

            if (err) {
                console.error(chalk.bold.red("ERROR: ") + err);
                throw (err);
            } else {
                fs.outputFileSync(file, output);
            }



        }, true);
    });
    console.log(chalk.bold.green("Done!"));

}

function generateRedirectFile(epub) {
    console.log(chalk.bold.cyan("Generating spine.csv..."));
    var data = "";
    var file = bookpath + "/web/spine.csv";


    for (var i = 0, len = epub.flow.length; i < len; i++) {
        data += (i + 1) + "," + path.basename(epub.flow[i].href) + "\n";
    }

    fs.outputFileSync(file, data);

    console.log(chalk.bold.green("spine.csv generated."));

}

function processEpubContent(epubfile) {

    console.log(chalk.bold.green("Processing epub content..."))
    try {

        var epub = new EPub(epubfile, "/images/", "/xhtml/");

        epub.on("end", function () {
            // epub is now usable
            console.log(chalk.bold.blue("Title: ") + epub.metadata.title);

            extractChapters(epub);
            generateRedirectFile(epub);

        });


        epub.parse();
    } catch (e) {
        logError("Can't parse epub")
    }
}

handlebars.registerHelper('link', function (href) {
    var url = href.substring(href.lastIndexOf('/') + 1)

    return new handlebars.SafeString(url);
});

handlebars.registerHelper('author', function (author) {
    if (author.indexOf("Sivaya") !== -1) {
        return new handlebars.SafeString("http://www.himalayanacademy.com/monastery/lineage-philosophy/gurudeva")
    }

    if (author.indexOf("Bodhinatha") !== -1) {
        return new handlebars.SafeString("http://dev.himalayanacademy.com/monastery/lineage-philosophy/bodhinatha")
    }

    if (author.indexOf("Yogaswami") !== -1) {
        return new handlebars.SafeString("http://dev.himalayanacademy.com/monastery/lineage-philosophy/yogaswami")
    }

    return new handlebars.SafeString("http://dev.himalayanacademy.com/monastery/lineage-philosophy")
})

/*handlebars.registerHelper("striptags", function( txt ){
	// exit now if text is undefined 
	if(typeof txt == "undefined") return;
	// the regular expresion
	var regexp = new RegExp('#([^\\s]*)','g');
	// replacing the text
	return txt.replace(regexp, '');
	
});*/


var appInfo = {
    title: 'HAP EPub Export Tool',
    description: 'Generates static HTML from EPub files.',
    footer: 'Project home: [HAP EPub Export Tool]{http://github.com/Himalayan-Academy/hap-epub-export-tool}'
}

var appOptions = [
    {
        name: 'fileId', description: "The File ID for the book (required)",
        type: String, alias: 'i', defaultOption: true
    }
];

var cli = commandLineArgs(appOptions);
var usage = cli.getUsage(appInfo, appOptions);
var options = cli.parse();


if (options.fileId) {

    try {
        if (options.fileId.indexOf("books/") !== -1) {
            options.fileId = options.fileId.replace("books/", "")
            console.log("replaced books prefix, now:", options.fileId)
        }

        if (!fs.existsSync(`books/${options.fileId}/${options.fileId}.epub`)) {
            logError("File epub doesn't exist")
        }

        if (ignored_books.find(id => options.fileId == id)) {
            logError("Book is in the ignored list")
        }

        getJSON("http://dev.himalayanacademy.com/api/index.php/record/" + options.fileId, function (error, response) {
            try {
                if (error) {
                    console.log("error: " + error);

                } else {
                    itemObj = response;

                    if (typeof itemObj.description == "undefined") {
                        throw "Something odd with the request:" + JSON.stringify(itemObj)

                    }

                    itemObj.description = itemObj.description.replace(/\n/g, " ");
                    options.epubFile = "books/" + options.fileId + "/" + options.fileId + ".epub";

                    console.log(chalk.bold.green("Processing: ") + options.epubFile);
                    console.log(chalk.bold.green("File ID: ") + options.fileId);

                    fileId = options.fileId;
                    bookpath = "books/" + fileId

                    copyOverrideFiles(bookpath);

                    extractResources(options.epubFile);

                    processEpubContent(options.epubFile);
                }
            } catch (e) {
                logError("ajax error:", e.message)
            }

        });
    } catch (e) {
        logError("Exception", e.message)
        process.exit(1)
    }

} else {
    console.log(usage);

}


