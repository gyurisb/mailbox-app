ngApp.controller('ReaderController', ['$scope', '$mailbox', '$app', '$master', '$filter', function($scope, $mailbox, $app, $master, $filter) {
    
    var downloadsInProgress = {};

    $app.onEmailFocus(function(email) {
        if (platform == "mobile" || email != $scope.email) {
            $mailbox.getEmailBody(email.path, email.uid, email.seen).success(function(body){
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

    $mailbox.onEmailUpdate(function(evt){
        if (evt.oldPath == $scope.email.path && evt.oldUid == $scope.email.uid) {
            $scope.email.path = evt.newPath;
            $scope.email.uid = evt.newUid;
        }
    });

    $mailbox.onFolderPathUpdate(function(evt){
        if (evt.oldPath == $scope.email.path || $scope.email.path.indexOf(evt.oldPath + evt.delimiter) == 0) {
            if (evt.newPath) {
                $scope.email.path = $scope.email.path.replace(evt.oldPath, evt.newPath);
            } else {
                $scope.email = null;
                $app.closeEmail();
            }
        }
    });

    $app.onEmailModify(function(path, uid) {
        if (path == $scope.email.path && (uid == $scope.email.uid || uid == null)) {
            $scope.email = null;
            $app.closeEmail();
        }
    });

    $scope.download = function(attachment) {
        $app.showSaveDialog(attachment.name, function(fileName){
            var attachmentKey = attachment.part + '/' + attachment.uid + '/' + $scope.email.path;
            downloadsInProgress[attachmentKey] = true;
            $scope.downloadInProgress = true;
            $mailbox.getEmailAttachment($scope.email.path, $scope.email.uid, attachment.part, fileName).success(finishProgress).error(function(err){
                finishProgress();
                alert("Error saving attachment:\n" + JSON.stringify(err))
            });
            function finishProgress() {
                delete downloadsInProgress[attachmentKey];
                $scope.downloadInProgress = Object.keys(downloadsInProgress).length;
            }
        });
    }

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
        $mailbox.deleteEmail($scope.email.path, $scope.email.uid);
        $app.modifyEmail($scope.email.path, $scope.email.uid);
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