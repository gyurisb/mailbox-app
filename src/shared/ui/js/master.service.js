ngApp.factory('$master', ['$rootScope', '$location', '$window',
    function($rootScope, $location, $window) {
        var pageView = undefined;
        var pages = undefined;
        var container = undefined;
        var loadedNum = 0;
        var scope = null;
        var index;
        
        $rootScope.$on('$locationChangeStart', function(){
            index = Number(($location.path() || "/0").substr(1));
            if (scope != null) {
                scope.path = index;
            }
        });
        
        return {
            focus: function(pageIndex) {
                $location.path(pageIndex);
            },
            isFocused: function(pageIndex) {
                if (platform == 'desktop') {
                    return true;
                } else {
                    return scope && scope.path == pageIndex;
                }
            },
            setScope: function(currentScope) {
                scope = currentScope;
                scope.path = index;
            }
        };
    }
]);
