ngApp.controller('NewController', ['$scope', '$mailbox', '$master', '$q', '$timeout', '$app', function($scope, $mailbox, $master, $q, $timeout, $app) {

    var replyToId = null;
    $scope.allowFormatting = (platform == "desktop");
    $scope.tinymceOptions = {
        onChange: function(e) {
        // put logic here for keypress and cut/paste changes
        },
        height: 400,
        plugins: [
            'advlist autolink lists link image charmap print preview anchor',
            'searchreplace visualblocks code fullscreen',
            'insertdatetime media table contextmenu paste code'
        ],
        menubar: false,
        statusbar: false,
        toolbar: 'insertfile undo redo | styleselect | fontselect fontsizeselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image',
        content_css: 'css/style-email.css'
    };

    $app.onEmailParameters(function(params){
        $scope.to = [];
        $scope.toBcc = [];
        $scope.message = { body: "" };
        $scope.attachments = [];
        if (params.replyTo) {
            replyToId = params.replyTo.id;
            if (params.forward) {
                $scope.subject = "Fw: " + params.replyTo.subject.replace(/Re:(\s)*/, '').replace(/Fw:(\s)*/, '');
                $scope.attachments = params.replyTo.attachments.map(function(attachment){ return { type: "part", part: attachment.part, name: attachment.name, size: attachment.size } });
            } else {
                $scope.subject = "Re: " + params.replyTo.subject.replace(/Re:(\s)*/, '');
                $scope.to = [ { name: params.replyTo.senderName || params.replyTo.senderEmail, email: params.replyTo.senderEmail } ];
                if (params.all) {
                    var ccTo = params.replyTo.ccRecipients.map(function(x){ return { name: x.name || x.email, email: x.email }; }).filter(function(x){ return x.email != $scope.emailAddress });
                    $scope.to = $scope.to.concat(ccTo);
                }
            }
            $scope.trailer = createTrailer(new Date(params.replyTo.date), params.replyTo.senderName, params.replyTo.senderEmail, params.replyTo.body);
            if ($scope.allowFormatting) {
                $scope.message.body = "<br><br>" + $scope.trailer;
            }
        }
    });
    
    $scope.querySearch = function(criteria) {
        return $q(function(resolve, reject) {
            $mailbox.contacts(criteria).success(function(contacts){
                if (contacts.length == 0 && criteria.match(/[^@]+@([^0-9@][^@]*\.[^@]+|localhost|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/g)) {
                    resolve([{name: criteria, email: criteria}]);
                } else {
                    resolve(contacts);
                }
            });
        });
    };
    
    $scope.send = function() {
        $scope.isSending = true;
        var body = $scope.message.body;
        if (!$scope.allowFormatting) {
            body = body.replace(/\n/g, '<br/>');
            if ($scope.trailer) {
                body = body + "<br><br>" + $scope.trailer;
            }
        }
        $mailbox.sendEmail({
            to: $scope.to.map(function(c) { return c.email; }),
            bcc: $scope.toBcc.map(function(c) { return c.email; }),
            subject: $scope.subject,
            body: body,
            attachments: $scope.attachments,
            replyToId: replyToId
        });
        $app.sendEmail();
    }

    $scope.attach = function() {
        $app.showOpenDialog(function(files){
            $scope.attachments = $scope.attachments.concat(files.map(function(f) { return { type: "file", name: f.name, path: f.path, size: f.size } }));
        }, function(){});
    }

    $scope.showBccInput = function(){
        $scope.showBcc = true;
    }

    $scope.removeAttachment = function(attachment) {
        $scope.attachments.splice($scope.attachments.indexOf(attachment), 1);
    }

    function createTrailer(originalDate, originalName, originalEmail, originalBody) {
        return '<div class="gmail_extra">\
                    <br>\
                    <div class="gmail_quote">\
                        ' + originalDate.toString() + ' ' + originalName + '\
                        <span dir="ltr">&lt;<a href="mailto:' + originalEmail + ' target="_blank">' + originalEmail + '</a>&gt;</span>:<br>\
                        <blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">\
                        ' + originalBody + '\
                        </blockquote>\
                    </div><br>\
                </div>';
    }
}]);

ngApp.directive('new', function(){
   return {
       restrict: 'AE',
       templateUrl: 'partials/new.html'
   }; 
});