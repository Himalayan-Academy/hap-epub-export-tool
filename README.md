# hap-epub-export-tool
A tool used internally by HAP to process epub files into static HTML webapps

## Installing

First clone the repository

```
$ git clone https://github.com/soapdog/hap-epub-export-tool.git
```

Then from inside the folder of the clone repo, link it.

```
$ npm link
```

You will end up with a command line tool called ```epubexport``` which you can call passing the epub file as seen below

```
$ epubexport what-is-hinduism.epub
```

This will cause a ```web``` folder to be created on the same folder as you are located. This folder will contain the processed files.

## Customizing the wrapper

The wrapper around the epub is based on a HandlerbarsJS template called ```template.hbs``` that will be present on the root folder of the cloned repo. The file called ```_style.css``` has the CSS rules used for the wrapper and the overrides.