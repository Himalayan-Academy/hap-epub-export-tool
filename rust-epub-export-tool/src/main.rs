extern crate epub;
extern crate image;
extern crate scraper;
#[macro_use]
extern crate tera;
#[macro_use]
extern crate lazy_static;

use epub::doc::EpubDoc;
use image::{FilterType, GenericImage};
use scraper::{Html, Selector};
use std::collections::HashMap;
use std::ffi::OsStr;
use std::fs;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use tera::{Context, Tera};

lazy_static! {
    pub static ref TERA: Tera = {
        let mut tera = compile_templates!("templates/**/*");
        // and we can add more things to our instance if we want to
        tera.autoescape_on(vec!["html"]);
        tera
    };
}

fn compress_cover(doc: &mut EpubDoc) {
    println!("Extracting cover...");
    let cover_data = doc.get_cover().unwrap();

    let f = fs::File::create("temp\\cover.jpg");
    assert!(f.is_ok());
    let mut f = f.unwrap();
    let _resp = f.write_all(&cover_data);
    println!("Compressing cover...");

    let img = image::open("temp/cover.jpg").unwrap();
    let resized = img.resize(1000, 1000, FilterType::Lanczos3);
    resized.save("web2/cover.jpg").expect("Saving image failed");
}

fn copy_raw_resource(doc: &mut EpubDoc, key: &str, path: &str) {
    let filename = Path::new(path)
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or_default();

    let data = doc.get_resource(key);

    // write raw file
    let raw_filename = format!("web2/resources/{}", &filename);
    let f = fs::File::create(&raw_filename);
    assert!(f.is_ok());
    let mut f = f.unwrap();
    let _resp = f.write_all(&data.unwrap().as_slice());
}

fn process_css_resource(doc: &mut EpubDoc, key: &str, path: &str) {
    let filename = Path::new(path)
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or_default();

    //  write fragment
    let str_data = doc.get_resource_str(key);

    let fixed_content = str_data.unwrap().replace("../fonts/", "");

    let full_path = format!("web2/resources/{}", &filename);
    let f = fs::File::create(&full_path);
    assert!(f.is_ok());
    let mut f = f.unwrap();
    let _resp = f.write_all(&fixed_content.as_bytes());
}

fn process_html_resource(doc: &mut EpubDoc, metadata: &HashMap<&str, &str>, key: &str, path: &str) {
    let ext = Path::new(path)
        .extension()
        .and_then(OsStr::to_str)
        .unwrap_or_default();

    let mut ctx = Context::new();
    ctx.add("meta", metadata);
    ctx.add("file_id", "merging-with-siva");

    let mut chapter = HashMap::new();
    chapter.insert("title", "chapter title");
    chapter.insert("id", "0");
    let mut item = HashMap::new();
    item.insert("description", "book description");

    ctx.add("chapter", &chapter);
    ctx.add("item", &item);

    //  write fragment
    let str_data = doc.get_resource_str(key);

    let fixed_content = str_data.unwrap().replace("../images", "images");

    let document = Html::parse_document(&fixed_content);
    let selector = Selector::parse("body").unwrap();
    let body = document.select(&selector).next().unwrap();
    ctx.add("content", &body.inner_html());
    let rendered = TERA
        .render("page.html", &ctx)
        .expect("Failed to render template");

    let fragment_filename = format!("web2/{}.{}", &key, &ext);
    let f = fs::File::create(&fragment_filename);
    assert!(f.is_ok());
    let mut f = f.unwrap();
    let _resp = f.write_all(&rendered.as_bytes());
}

fn compress_image_resource(doc: &mut EpubDoc, key: &str, path: &str) {
    // write compressed
    let ext = Path::new(path)
        .extension()
        .and_then(OsStr::to_str)
        .unwrap_or_default();

    let raw_filename = format!("temp/images/{}.{}", &key, &ext);
    let data = doc.get_resource(key);

    // write raw file
    let f = fs::File::create(&raw_filename);
    assert!(f.is_ok());
    let mut f = f.unwrap();
    let _resp = f.write_all(&data.unwrap().as_slice());

    let img = image::open(raw_filename).unwrap();
    let (width, _height) = img.dimensions();
    let compressed_filename = format!("web2/images/{}.{}", &key, &ext);

    if width > 600 {
        let resized = img.resize(600, 600, FilterType::Lanczos3);
        resized
            .save(&compressed_filename)
            .expect("Saving image failed");
    } else {
        let data = doc.get_resource(key);

        let f = fs::File::create(&compressed_filename);
        assert!(f.is_ok());
        let mut f = f.unwrap();
        let _resp = f.write_all(&data.unwrap().as_slice());
    }
}

fn main() {
    println!("HAP Epub Export Tool (rust version)");
    let doc = EpubDoc::new("test.epub");

    assert!(doc.is_ok());
    let mut doc = doc.unwrap();

    let _resp = fs::create_dir_all("temp/images/");
    let _resp = fs::create_dir_all("web2/images/");
    let _resp = fs::create_dir_all("web2/resources/");

    let num_resources = doc.resources.len();
    println!("Total resources listed in Epub: {}", num_resources);
    let mut metadata = HashMap::new();
    let title = doc.mdata("creator").unwrap_or_default();
    let author = doc.mdata("title").unwrap_or_default();
    let date = doc.mdata("date").unwrap_or_default();

    println!("{} - {} ({})", &title, &author, &date);

    metadata.insert("title", "Merging With Siva");
    metadata.insert("author", "Sivaya Subramunyiaswami");
    metadata.insert("date", "1234");

    compress_cover(&mut doc);

    let resources = doc.resources.clone();
    println!("Extracting resources...");

    // END

    for (key, val) in resources.iter() {
        let path = &val.0;
        let mime = doc.get_resource_mime_by_path(&path).unwrap_or_default();
        println!("{} - {}", &key, &mime);
        println!("{}", &path);

        if mime.contains("image/") {
            compress_image_resource(&mut doc, &key, &path);
        } else if mime.contains("html") {
            process_html_resource(&mut doc, &metadata, &key, &path);
        } else if mime.contains("css") {
            process_css_resource(&mut doc, &key, &path);
        } else {
            copy_raw_resource(&mut doc, &key, &path);
        }
    }
}
