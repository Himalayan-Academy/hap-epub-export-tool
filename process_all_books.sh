#!/bin/bash 
set -e 

echo "will take a while, rest..."

for book in books/*;
    do
        [ -d $book ] && echo $book... && node index.js $book
    done;
