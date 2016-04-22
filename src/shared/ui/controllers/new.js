app.controller('NewController', ['$scope', '$mailbox', '$master', '$q', '$timeout', function($scope, $mailbox, $master, $q, $timeout) {
    
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
    
    $mailbox.onError(function(error) {
        alert(JSON.stringify(error));
    });
    
    $scope.to = [];
    $scope.toBcc = [];
    
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
        $mailbox.sendEmail({
            to: $scope.to.map(function(contact) { return contact.email; }), //contact => contact.email
            subject: $scope.subject,
            body: $scope.text
        });
        //TODO: itt bezárni az ablakot/visszalépni
    }
}]);