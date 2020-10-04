/*global angular, _eventPage, _i18n, _storage, purl*/

/*global _storage*/

/*
 * This file is a part of textport.
 * 
 * textport is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * textport is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
 *
 * textport was built with the help of einzelcode's Super Simple Highlighter repository (covered under the same license)
 */


var _stylesheet = {
    /**
     * Apply rules of a single highlight style
     */
    setHighlightStyle: function (definition) {
        "use strict";
        var $ss = $.stylesheet('.' + definition.className);

        // The stored colours never specify alpha, to be able to be used in the HTML input element.
        // So we parse the rgba? colour, and add a constant alpha

        // definition.style["background-color"] must be a string in format "#RRGGBB"
        // copy because we modify the object
        var style = jQuery.extend(true, {}, definition.style);

        if (definition.inherit_style_color) {
            style.color = "inherit";
        }

        // account for styles defined before box-shadow was defined
        var backgroundColor = style['background-color'];
        style["box-shadow"] = "0 0 8px " + backgroundColor;

        var re = new RegExp("^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})", "ig");
        var match = re.exec(backgroundColor);

        if (match && match.length >= 4) {
            _storage.getHighlightBackgroundAlpha(function(alpha){
                if (alpha === undefined) { return; }

                style["background-color"] = "rgba(" +
                    parseInt(match[1], 16) + ", " +
                    parseInt(match[2], 16) + ", " +
                    parseInt(match[3], 16) + ", " +
                    alpha +
                    ")";

                $ss.css(null).css(style);
            });
        } else {
            console.log("highlight style background colour not in #RRGGBB format");
        }

//
//
//
//
//        $ss.css(null).css(definition.style);
//
//        // The stored colours never specify alpha, to be able to be used in the HTML input element.
//        // So we parse the rgba? colour, and add a constant alpha
//        var re = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/;
//
//        var match = re.exec($ss.css('background-color'));
//        if (match && match.length >= 4) {
//            chrome.storage.sync.get({
//                highlightBackgroundAlpha: 0.8
//            }, function (items) {
//                if (chrome.runtime.lastError) {
//                    return;
//                }
//
//                var rgba = "rgba(" +
//                    match[1] + ", " +
//                    match[2] + ", " +
//                    match[3] + ", " +
//                    items.highlightBackgroundAlpha +
//                    ")";
//
//                $ss.css('background-color', rgba);
//            });
//        }
    },

    /**
     * Remove rules for a single style
     * @param className
     */
    clearHighlightStyle: function (className) {
        "use strict";
        $.stylesheet('.' + className).css(null);
    }
};

/**
 * Controllers module
 * @type {ng.IModule}
 */
var overviewControllers = angular.module('overviewControllers', []);


// array this is something to do with minification
overviewControllers.controller('DocumentsController', ["$scope", function ($scope) {
    'use strict';
	var backgroundPage;
	
    $scope.manifest = chrome.runtime.getManifest();

    /**
     * Initializer, called from the starter section
     * @param {number} [tabId] tab id of the tab associated with the popup that navigated here, or NaN if not known or specified
     * @param {string} url tab url
     * @param {string} [title] optional tab title
     * @param {object} bgPage
     */
    function onInit(tabId, url, title, bgPage){
		$scope.tabId = tabId;
		$scope.url = url;

		// share title with that of the source page
        $scope.title = title;
		// document.title = chrome.i18n.getMessage("overview_document_title", [title]);

		// used to scroll tab's page to the clicked highlight
		backgroundPage = bgPage;

        // get all the documents (create & delete) associated with the match, then filter the deleted ones
        var match = backgroundPage._database.buildMatchString(url);

        backgroundPage._database.getCreateDocuments(match, function (err, docs) {
			if (err) {
				return;
			}
			
            $scope.docs = docs;
			
			// we form the plural string in the controller instead of the view, because ngPluralize can't refer to i18n things
			var length = docs.length;
			var messageName;
			
			if (length == 0) {
				messageName = "plural_zero_highlights";
			} else if (length == 1) {
				messageName = "plural_one_highlight";
			} else {
				messageName = "plural_other_highlights";
			}
			
			$scope.docsCount = chrome.i18n.getMessage(messageName, [docs.length]);
            $scope.$apply();

            // if the highlight cant be found in DOM, flag that
            if (!isNaN(tabId)) {
                docs.forEach(function (doc) {
                    // default to undefined, implying it IS in the DOM
                    backgroundPage._eventPage.isHighlightInDOM(tabId, doc._id, function (isInDOM) {
                        //                    if (!isInDOM) {
                        //                        console.log("Not in DOM");
                        //                    }

                        doc.isInDOM = isInDOM;
                        $scope.$apply();
                    });
                });
            }
        });
    }

	/**
	 * Clicked the header, showing the source page title.
     * Makes corresponding tab active
	 * @type function
	 */
	$scope.onClickPageUrl = function () {
		// make the tab which was associated with the popup that launched us the active tab.
		// If it has been closed nothing will happen (but the user can open explicitly from the anchor instead)
		chrome.tabs.update($scope.tabId, {
			active: true
		});
	}

	/**
	 * Clicked a highlight. Make the associated tab active, and scroll it to its position
	 * @param {Object} doc highlight document which was clicked
	 */	
	$scope.onClickHighlight = function(doc) {
		// if scrolling to the element is successful, only then we can make the tab active
        backgroundPage._eventPage.scrollTo($scope.tabId, doc._id, function(didScroll) {
        	if (didScroll) {
				// make it the active tab
				chrome.tabs.update($scope.tabId, {
					active: true
				});
        	}
        });
		
	}




	/**
	 * Starter 
	 * parse href (supplied by popup's controller) to find url, which is used to find match string
	 */
    var u = purl(location.href),
        id = u.param('id'), url = u.param('url'), title = u.param('title');

    if (url !== undefined) {
        chrome.runtime.getBackgroundPage(function (backgroundPage) {
            onInit(parseInt(id), url, title, backgroundPage);
        });
    }



//    chrome.tabs.query({ active: true, currentWindow: true }, function (result) {
//        chrome.runtime.getBackgroundPage(function (backgroundPage) {
//            onInit(result[0], backgroundPage);
//        });
//    });

}]);
