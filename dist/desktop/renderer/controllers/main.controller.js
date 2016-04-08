var userName;

app.controller('mainController', ['$scope', '$sce', '$email', function($scope, $sce, $email) {
    $email.onError(function(error){
        $scope.loginInProgress = false;
        alert(JSON.stringify(error));
    });
    
    $scope.formUserName = "gyuris.bence@hotmail.com";
    $scope.formPassword = "";
    $scope.loginInProgress = false;
    $scope.loggedIn = false;
    $scope.login = function() {
        $scope.userName = $scope.formUserName;
        $scope.loginInProgress = true;
        $email.login({
            imapHost: "imap-mail.outlook.com",
            imapPort: 993,
            smtpHost: "smtp.live.com",
            smtpPort: 587,//25,
            username: $scope.userName,
            password: $scope.formPassword
        }).success(function(loginSuccessful){
            $scope.loginInProgress = false;
            if (loginSuccessful == true) {
                $scope.loggedIn = true;
                $email.getFolders().success(setFolders);
                $email.getEmails().success(setEmails);
            }
        });
    }
    
    $scope.newEmail = function() {
        ipcRenderer.send('openNewEmailWindow');
    }
    
    $scope.folders = [];
    $scope.selectedFolder = null;
    $scope.folderClicked = function(folder) {
        $scope.selectedFolder = folder;
        $email.getEmails(folder.path).success(setEmails);
    }
    
    $scope.emails = [];
    $scope.selectedEmail = null;
    $scope.emailClicked = function(email) {
        $scope.selectedEmail = email.uid;
        $email.getEmailBody(email.uid).success(function(arg){
            var encodedText = arg.text.replace(/"/g, '&quot;');
            if (arg.type == "text/plain") {
                encodedText = encodedText.replace(/\n/g, '<br/>');
            }
            // else {
            //     ecodedText = encodedText.replace(/<a/g, "<a target='_blank'");
            // }
            // alert(encodedText);
            //$('#email-frame').attr('srcdoc', encodedText);
            //model.setEmailBody(encodedText);
            $(".email-area").empty();
            $(".email-area").append('<iframe id="email-frame" sandbox seamless srcdoc="' + encodedText + '"></iframe>');
        });
    }
    
    // $scope.emailBody = "";
    // $scope.setEmailBody = function(body) {
    //     $scope.emailBody($sce.trustAsHtml(body));
    // }
    
    function setFolders(foldersObj) {
        $scope.folders = foldersObj.children;
    }
    function setEmails(emails) {
        $scope.emails = emails;
    }
}]);