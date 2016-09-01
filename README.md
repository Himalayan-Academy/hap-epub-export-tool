# hap-epub-export-tool
A tool used internally by HAP to process epub files into static HTML webapps

## Installing

First clone the repository

```
$ git clone https://github.com/soapdog/hap-epub-export-tool.git
```

Then from inside the folder of the clone repo, run the initial setup and link it.

```
$ npm install && npm link
```

You will end up with a command line tool called ```epubexport```.

## Running it
The epubexport tool can be run like:

```
$ epubexport what-is-hinduism
```

Or if it is not linked with ```npm link```, it can be run with:

```
$ node index.js what-is-hinduism
```
This will make the tool look into a file called ```books/<fileid>/<fileid>.epub```. This will cause a ```web``` folder to be created on the same folder as the one that contains the epub file. This folder will contain the processed files.

## Previewing the files
If you have ```live-server``` installed, you can just navigate to inside the *web* folder and run:

```
$ live-server
```

Which will cause your default browser to launch and the book page to open.

## Customizing the wrapper

The wrapper around the epub is based on a HandlerbarsJS template called ```template.hbs``` that will be present on the root folder of the cloned repo. The file called ```_style.css``` has the CSS rules used for the wrapper and the overrides.

---

# Extra tools

# Downloading all epub files
A script called ```download_all_books.sh``` is provided which will use rsync to create a local ```books``` folder and host all the epubs from our media folder. Since it uses *rsync* to download the files, it will only download new stuff when it syncs again.

> **Attention:** It does take a while to run it for the first time.

# Processing all epub files
The script called ```process_all_books.sh``` will execute ```node index.js <fileid>``` for all books. 

> **Warning:** Many epubs have the wrong filename when you download them from the server. The name should always be the same name as the folder (aka the fileId) plus the ```.epub``` extension. This is not happening for many book and I had to rename them by hand on my local drive.

# Removing all web folders
The script called ```delete_all_web_folders.sh``` will execute **remove the web folder** from all books. 

# Upload all books
The script called ```sync_all_books.sh``` uses rsync to sync all books. 




