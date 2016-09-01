with open('allbooks.txt','r') as f:
    with open('upload_all_books.sh','w') as g:
        print >>g, "#!/bin/bash"
        print >> g, "echo 'Uploading all books...'"
        print >> g, "set -e"
        print >> g, ""
        for book in f:
            book = book.rstrip()
            if not book: continue
            print >> g, "rsync -avz books/{0}/web devhap@dev.himalayanacademy.com:public_html/media/books/{0}/".format(book)