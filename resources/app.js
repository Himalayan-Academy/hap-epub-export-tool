
$(document).ready(function() {
    if (location.hash !== "") {
        var para =  location.hash;
        var el = $(para);

        console.log("jumping to " + para);

        el.parent().css("background-color", "lightgray");

        var elOffset = el.offset().top;
        var elHeight = el.height();
        var windowHeight = window.innerHeight;
        var offset;

        if (elHeight < windowHeight) {
            offset = elOffset - ((windowHeight / 2) - (elHeight / 2));
        }
        else {
            offset = elOffset;
        }

        window.scrollTo(0,offset);


    }



    // Start the foundation libraries
    $(document).foundation();
});



