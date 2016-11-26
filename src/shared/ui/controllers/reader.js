ngApp.controller('ReaderController', ['$scope', '$mailbox', '$app', '$master', '$filter', function($scope, $mailbox, $app, $master, $filter) {
    
    $scope.downloadsInProgress = {};

    $app.onEmailFocus(function(email) {
        if (platform == "mobile" || email != $scope.email) {
            $mailbox.getEmailBody(email.id).success(function(body){
                $scope.titles[2] = email.subject;
                $master.focus(2);
                if (email.contentType == "text/plain") {
                    body = body.replace(/\n/g, '<br/>');
                }
                $scope.email = email;
                $scope.email.body = body;
                $('#email-frame').contents().find('html').html(body);
                $('#email-frame').contents().find('a').each(function(i, elBase){
                    var el = $(elBase);
                    el.attr('fake-href', el.attr('href'));
                    el.attr('href', 'javascript:void(0)');
                    el.click(function(evt){
                        evt.stopPropagation();
                        $app.openLink(el.attr('fake-href'));
                    });
                });
            });
        }
    });

    $app.onEmailModify(function(emailId) {
        if ($scope.email && emailId == $scope.email.id) {
            $scope.email = null;
            $app.closeEmail();
        }
    });

    $scope.download = function(attachment) {
        $app.showSaveDialog(attachment.name, function(filePath){
            $scope.downloadsInProgress[$scope.email.id] = $scope.downloadsInProgress[$scope.email.id] || 0;
            $scope.downloadsInProgress[$scope.email.id]++;
            $mailbox.getEmailAttachment($scope.email.id, attachment.part, filePath);
        });
    }

    $mailbox.onDownloadFinish(function(evt){
        $scope.downloadsInProgress[evt.emailId]--;
    });

    $scope.reply = function() {
        $app.newEmail({ replyTo: $scope.email });
    }

    $scope.replyAll = function() {
        $app.newEmail({ replyTo: $scope.email, all: true });
    }

    $scope.forward = function() {
        $app.newEmail({ replyTo: $scope.email, forward: true });
    }

    $scope.delete = function() {
        $mailbox.deleteEmail($scope.email.id);
        $app.modifyEmail($scope.email.id);
    }

    $scope.formatEmailDate = function(dateString) {
        var date = new Date(dateString);
        return $filter('date')(date, 'medium');
    }
    $scope.formatContact = function(name, email) {
        if (name) {
            return name + " (" + email + ")";
        } else {
            return email;
        }
    }
}]);

ngApp.directive('reader', function(){
   return {
       restrict: 'EA',
       templateUrl: 'partials/reader.html',
   }; 
});