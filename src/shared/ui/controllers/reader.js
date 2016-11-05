ngApp.controller('ReaderController', ['$scope', '$mailbox', '$app', '$master', '$filter', function($scope, $mailbox, $app, $master, $filter) {
    
    $app.onEmailFocus(function(email, path) {
        if (platform == "mobile" || email != $scope.email) {
            $mailbox.getEmailBody(path, email.uid, email.seen).success(function(body){
                $master.focus(2);
                $scope.email = email;
                $scope.attachments = email.attachments;
                if (email.contentType == "text/plain") {
                    body = body.replace(/\n/g, '<br/>');
                }
                $('#email-frame').contents().find('html').html(body);
            });
        }
    });

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