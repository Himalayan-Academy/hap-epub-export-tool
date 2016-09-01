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

var fileId = "";
var bookpath = "";
var imageQuality = 80;


function getFilesizeInBytes(filename) {
 var stats = fs.statSync(filename)
 var fileSizeInBytes = stats["size"]
 return fileSizeInBytes
}

function fixSVGCovers(text) {
    text = text.replace(/svg:/gi,"");

    return text;
}

function addIDsToParagraphs(text) {
    var $ = cheerio.load(text);
    var paragraphSelectors = ["p.indent","p.noindent","p.paraspaceabove","p.paraspaceabove2", "p.quote","p.quotexx","h5.textcenter"];
    var x = 0;

    paragraphSelectors.forEach(function(selector) {
        $(selector).each(function(i, elem) {
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
                    console.log(chalk.bold.cyan("Processing image... (size: "+bytes+" bytes)"));
                    var command = "/usr/local/Cellar/imagemagick/6.9.3-7/bin/convert \""+ imageFile+"\" pnm:- | /usr/local/Cellar/mozjpeg/3.1/bin/cjpeg -quality "+ imageQuality +"  > '"+ imageFile +"_proc' && rm \""+imageFile+"\" && mv \"" + imageFile +"_proc\" " + "\"" + imageFile +"\"";
                    
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
            meta: epub.metadata,
            file_id: fileId,
            toc: epub.toc,
            previous: false,
            next: false
        };


        // find previous and next links

        var previousTocItem = _.find(epub.toc, function(o){
            var match = o.order == chapter.order - 1;
            return match;
        });

        var nextTocItem = _.find(epub.toc, function(o){
            return o.order == chapter.order + 1;
        });

        var currentSpineItem = _.findIndex(epub.flow, function(o){
            if (o.href == chapter.href) {
                return true;
            } else {
                return false;
            }

        });

        console.log("current spine item: " + currentSpineItem)

        var previousSpineItem = epub.flow[currentSpineItem - 1] || false;
        var nextSpineItem =  epub.flow[currentSpineItem + 1] || false;


        if (previousSpineItem) {
            data.previous = path.basename(previousSpineItem.href);
        } else {
            data.previous = false;
        }

        if (nextSpineItem) {
            data.next = path.basename(nextSpineItem.href);
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
                console.error(chalk.bold.red("ERROR: ") +err);
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


    for(var i = 0, len = epub.flow.length; i < len; i++) {
        data += (i + 1) + "," + path.basename(epub.flow[i].href) + "\n";
    }

    fs.outputFileSync(file, data);

    console.log(chalk.bold.green("spine.csv generated."));

}

function processEpubContent(epubfile) {


    var epub = new EPub(epubfile, "/images/", "/xhtml/");

    epub.on("end", function () {
        // epub is now usable
        console.log(chalk.bold.blue("Title: ") + epub.metadata.title);

        extractChapters(epub);
        generateRedirectFile(epub);

    });

    epub.parse();
}

handlebars.registerHelper('link', function(href) {
    var url = href.substring(href.lastIndexOf('/')+1)
    return new handlebars.SafeString(url);
});


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
    options.epubFile = "books/" + options.fileId + "/" + options.fileId + ".epub";
        
    console.log(chalk.bold.green("Processing: ") + options.epubFile);
    console.log(chalk.bold.green("File ID: ") + options.fileId);

    fileId = options.fileId;
    bookpath = "books/" + fileId
    
    copyOverrideFiles(bookpath);
   
    extractResources(options.epubFile);
   
    
    processEpubContent(options.epubFile);
  
    
    
} else {
    console.log(usage);
    
}

