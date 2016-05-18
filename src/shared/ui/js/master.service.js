var masterIncludedDivCount = 3;

ngApp.factory('$master', ['$rootScope', '$location', '$window',
    function($rootScope, $location, $window) {
        var pageView = undefined;
        var pages = undefined;
        var container = undefined;
        var loadedNum = 0;
        
        var firstOnStart = true;
        $rootScope.$on('$locationChangeStart', function(){
            if ($location.path() != "") {
                var index = Number($location.path().substr(1));
                focusPage(index);
            } else {
                if (firstOnStart) {
                    firstOnStart = false;
                } else {
                    navigator.app.exitApp();
                }
            }
        });
        
        return {
            focus: function(pageIndex) {
                $location.path(pageIndex);
            },
            includedDivLoaded: function() {
                loadedNum++;
                if (loadedNum == masterIncludedDivCount) {
                    $location.path(0);
                }
            }
        };
        function focusPage(pageIndex) {
            if (pageView === undefined) {
                pageView = $('*[page-view]');
                if (pageView.size() > 0) {
                    $('body').append('<div hidden id="page-container"/>');
                    pages = $('*[master-layout] *[page]');
                    pages.appendTo('#page-container');
                    $('*[master-layout]').remove();
                    container = $('#page-container');
                }
            }
            if (pages !== undefined) {
                container.append(pageView.children());
                pageView.html(pages[pageIndex]);
            }
        }
    }
]);
