#!/bin/bash 
set -e 

cd books

for book in *;
    do
        [ -d $book ] && [ ! -f $book/$book.epub ] && echo $book 
    done;
cd ..