ngApp.controller('ReaderController', ['$scope', '$mailbox', '$app', '$master', function($scope, $mailbox, $app, $master) {
    
    $app.onEmailFocus(function(uid, path) {
        $mailbox.getEmailBody(uid, path).success(function(body){
            var encodedText = body.text.replace(/"/g, '&quot;');
            if (body.type == "text/plain") {
                encodedText = encodedText.replace(/\n/g, '<br/>');
            }
            if (platform == 'desktop') {
                $(".email-area").empty();
                $(".email-area").append('<iframe id="email-frame" sandbox seamless srcdoc="' + encodedText + '"></iframe>');
            } else {
                $('.email-area').html(body.text);
            }
            $master.focus(2);
        });
    });       
}]);