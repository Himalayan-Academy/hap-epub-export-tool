#!/bin/bash
echo 'Uploading all books...'
set -e

[ -f upload_each_book.sh ] && rm upload_each_book.sh

echo "#!/bin/bash" >  upload_each_book.sh


for book in books/*;
    do
        [ -d $book ] && \
        echo $book... && \
        echo rsync -avzW $book/web devhap@dev.himalayanacademy.com:public_html/media/$book/ >>   upload_each_book.sh && \
        rsync -avzW $book/web devhap@dev.himalayanacademy.com:public_html/media/$book/ && \
        echo "Sleeping..." && \
        sleep 10
    done;

