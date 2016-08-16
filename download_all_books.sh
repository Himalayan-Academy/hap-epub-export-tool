#!/bin/bash

echo "syncing all epubs... will take a while."

mkdir books
rsync -rv --include '*/' --include '*.epub' --exclude '*' --exclude '*nook.epub' --prune-empty-dirs devhap@dev.himalayanacademy.com:public_html/media/books/ ./books/

echo "All done!"