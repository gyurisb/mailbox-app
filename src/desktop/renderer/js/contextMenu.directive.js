ngApp.directive('contextMenu', ['$app', '$rootScope', function($app, $rootScope){

    var activeContextMenu = null;

    ipcRenderer.on('contextMenuClick', function(event, args){
        activeContextMenu[args.menuId].click();
        $rootScope.$apply();
    });

    return {
        restrict: 'A',
        scope: {
            contextMenu: '='
        },
        link: function(scope, element) {
            element.off('contextmenu');
            element.on('contextmenu', function(e) {
                if (scope.contextMenu) {
                    e.preventDefault();
                    activeContextMenu = scope.contextMenu;
                    ipcRenderer.send('openContextMenu', { menu: scope.contextMenu });
                }
            });
        }
    }; 
}]);