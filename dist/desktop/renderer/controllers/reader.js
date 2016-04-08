app.controller('ReaderController', ['$scope', '$email', '$app', '$master', function($scope, $email, $app, $master) {
    
    $app.onEmailFocus(function(uid) {
        $email.getEmailBody(uid).success(function(body){
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
            $master.focus(3);
        });
    });       
}]);