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

var fileId = "";
var imageQuality = 80;


function getFilesizeInBytes(filename) {
 var stats = fs.statSync(filename)
 var fileSizeInBytes = stats["size"]
 return fileSizeInBytes
}

function execSync(command) {
   var result = child_process.execSync(command, { encoding: 'utf8' });
   
   return result;
   
}

function copyOverrideFiles() {
    console.log(chalk.bold.green("removing old folder..."));
    fs.removeSync(fileId + "/web");

    console.log(chalk.bold.green("creating folder structure and copying basic files..."));
    fs.mkdirsSync(fileId + "/web/styles");
    fs.mkdirsSync(fileId + "/web/images");
    fs.mkdirsSync(fileId + "/web/vendor");
    fs.copySync(__dirname + "/resources/index.html", fileId + "/web/index.html");
    fs.copySync(__dirname + "/resources/logo.svg", fileId + "/web/images/logo.svg");
    fs.copySync(__dirname + "/resources/_style.css", fileId + "/web/styles/_style.css");
    fs.copySync(__dirname + "/resources/foundation-6", fileId + "/web/vendor/foundation-6");

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
                outputPath = fileId + "/web/styles/";
                break;

            case ".jpg":
            case ".png":
                outputPath = fileId + "/web/images/";
                break;

            default:
                return;
                break;
        }

        zip.extractEntryTo(zipEntry.entryName, outputPath, false, true);
        
        console.log(chalk.bold.cyan("extracting: ") + zipEntry.name); // outputs zip entries information

        if (extension == ".jpg") {
            var imageFile = outputPath + path.basename(zipEntry.name);
                        
            var bytes = getFilesizeInBytes(imageFile);
            if (bytes > 130000) {
                console.log(chalk.bold.cyan("Processing image... (size: "+bytes+" bytes)"));
                var command = "/usr/local/Cellar/imagemagick/6.9.3-7/bin/convert \""+ imageFile+"\" pnm:- | /usr/local/Cellar/mozjpeg/3.1/bin/cjpeg -quality "+ imageQuality +"  > '"+ imageFile +"_proc' && rm \""+imageFile+"\" && mv \"" + imageFile +"_proc\" " + "\"" + imageFile +"\"";
                
                console.log(command);
                
                var result = execSync(command);
                
                console.log(result);
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

        var file = fileId + "/web/" + chapter.id + ".html";

        var data = {
            meta: epub.metadata,
            file_id: fileId,
            toc: epub.toc,
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
        } else {
            data.previous = "#"
        }

        if (nextTocItem) {
            data.next = path.basename(nextTocItem.href);
        } else {
            data.previous = "#"
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

function generateRedirectFile(epub) {
    console.log(chalk.bold.cyan("Generating spine.csv..."));
    var data = "";
    var file = fileId + "/web/spine.csv";


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
  footer: 'Project home: [HAP EPub Export Tool]{http://github.com/soapdog/hap-epub-export-tool}'
}
 
var appOptions = [
  { 
      name: 'extractImages', description: "Extract and optimize images",
      alias: 'e', type: Boolean 
  },
  { 
      name: 'epubFile', description: "EPub file to be processed (required)", 
      type: String, defaultOption: true, alias: "b" 
  },
  {
      name: 'fileId', description: "The File ID for the book (required)",
      type: String, alias: 'i'
  }
];
 
var cli = commandLineArgs(appOptions);
var usage = cli.getUsage(appInfo, appOptions);
var options = cli.parse();


if (options.epubFile && options.fileId) {
        
    console.log(chalk.bold.green("Processing: ") + options.epubFile);
    console.log(chalk.bold.green("File ID: ") + options.fileId);

    fileId = options.fileId;
    
    copyOverrideFiles();
    
    if (options.extractImages) {
        extractResources(options.epubFile);
    }
    
    processEpubContent(options.epubFile);
  
    
    
} else {
    console.log(usage);
    
}

