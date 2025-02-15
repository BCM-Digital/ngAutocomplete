'use strict';

/**
 * A directive for adding google places autocomplete to a text box
 * google places autocomplete info: https://developers.google.com/maps/documentation/javascript/places
 *
 * Usage:
 *
 * <input type="text"  ng-autocomplete ng-model="autocomplete" options="options" details="details/>
 *
 * + ng-model - autocomplete textbox value
 *
 * + details - more detailed autocomplete result, includes address parts, latlng, etc. (Optional)
 *
 * + options - configuration for the autocomplete (Optional)
 *
 *       + types: type,        String, values can be 'geocode', 'establishment', '(regions)', or '(cities)'
 *       + bounds: bounds,     Google maps LatLngBounds Object, biases results to bounds, but may return results outside these bounds
 *       + country: country    String, ISO 3166-1 Alpha-2 compatible country code. examples; 'ca', 'us', 'gb'
 *       + watchEnter:         Boolean, true; on Enter select top autocomplete result. false(default); enter ends autocomplete
 *       + fields:              Array of string. Define autocomplete fields to be returned. e.g. fields: ['name', 'place_id', 'type', 'vicinity']
 *
 * example:
 *
 *    options = {
 *      types: '(cities)',
 *      country: 'ca'
 *    }
 *
 *    initialAddress = {
 *      lat: 40.7128 ,
 *      lng: 74.0059
 *    }
 **/

angular.module("ngPlacesAutocomplete", [])
  .directive('ngPlacesAutocomplete', function () {
    return {
      require: 'ngModel',
      scope: {
        ngModel: '=ngModel',
        options: '=?',
        details: '=?',
        placeId: '=?',
        initialAddress: '=?'
      },

      link: function (scope, element, attrs, controller) {

        //options for autocomplete
        var watchEnter = false;
        var opts = {};

        // Default places fields to use if not passed.
        // Avoids additional Google Maps Platform costs.
        var defaultPlacesFields = [
          'address_component',
          'adr_address',
          'formatted_address',
          'geometry',
          'icon',
          'name',
          'permanently_closed',
          'photo',
          'place_id',
          'plus_code',
          'type',
          'url',
          'vicinity'
        ];

        //convert options provided to opts
        var initOpts = function () {

          if (scope.options) {

            if (scope.options.watchEnter !== true) {
              watchEnter = false;
            } else {
              watchEnter = true;
            }

            if (scope.options.types) {
              opts.types = scope.options.types;
              scope.gPlace.setTypes(opts.types);
            } else {
              scope.gPlace.setTypes([]);
            }

            if (scope.options.bounds) {
              opts.bounds = scope.options.bounds;
              scope.gPlace.setBounds(opts.bounds);
            } else {
              scope.gPlace.setBounds(null);
            }
            /*dissable until gmaps team solve the issue.*/
            if (scope.options.country) {
              opts.componentRestrictions = {
                country: scope.options.country
              };
              scope.gPlace.setComponentRestrictions(opts.componentRestrictions);
            } else {
              scope.gPlace.setComponentRestrictions(null);
            }

            // Set fields to be returned as part of autocomplete request if supplied via options.
            if (scope.options.fields) {
              opts.fields = scope.options.fields;
              scope.gPlace.setFields(opts.fields);
            } else {
              scope.gPlace.setFields(null);
            }
          }
        };

        var initPlace = function () {
          if (scope.placeId) {
            getPlaceDetails();
          }
        };

        var initInitialAddress = function () {
          if (scope.placeId) {
            console.warn('Using PlaceId to configure the Autocomplete component.');
          } else if (scope.initialAddress && scope.initialAddress.lat && scope.initialAddress.lng) {
            var geocoder = new google.maps.Geocoder;
            geocoder.geocode({
              'location': scope.initialAddress
            }, function (results, status) {
              if (status === google.maps.GeocoderStatus.OK) {
                if (results[0]) {
                  scope.$apply(function () {

                    controller.$setViewValue(results[0].formatted_address);
                    element.val(results[0].formatted_address);

                    scope.details = results[0];

                    //on focusout the value reverts, need to set it again.
                    var watchFocusOut = element.on('focusout', function (event) {
                      element.val(results[0].formatted_address);
                      element.unbind('focusout');
                    });

                  });
                } else {
                  console.warn('No results found');
                }
              } else {
                console.warn('Geocoder failed due to: ' + status);
              }
            });
          }
        }

        element.bind("keydown keypress", function (event) {
          if (event.which === 13) {
            scope.$apply(function () {
              controller.$setViewValue(element.val());
            });
          }
        });

        if (scope.gPlace === undefined) {
          scope.gPlace = new google.maps.places.Autocomplete(element[0], {});

          // Set default fields to be returned by autocomplete if none supplied via options
          if (scope.options.fields === undefined) {
            scope.gPlace.setFields(defaultPlacesFields);
          }
        }

        google.maps.event.addListener(scope.gPlace, 'place_changed', function () {
          var result = scope.gPlace.getPlace();
          if (result && result.address_components) {
            scope.$apply(function () {

              scope.details = result;

              controller.$setViewValue(element.val());
            });
          } else {
            if (watchEnter) {
              // Get first autocomplete result for the current input value.
              getPlace({ name: controller.$viewValue });
              element[0].blur();
            }
          }
        });

        /**
         * Retrieve the autocompletes first result using the AutocompleteService
         */
        var getPlace = function (result) {
          var autocompleteService = new google.maps.places.AutocompleteService();

          if (result.name.length > 0) {
            autocompleteService.getPlacePredictions({
                input: result.name,
                offset: result.name.length,
                componentRestrictions: opts.componentRestrictions,
                types: scope.options.types || []
              },
              function listentoresult(list, status) {
                if (list === null || list.length === 0) {

                  scope.$apply(function () {
                    scope.$emit('ngPlacesAutocomplete:no-results');
                    scope.details = null;
                  });

                } else {
                  getPlaceDetails(list);
                }
              });
          }
        };

        /**
         * Return the details for the place chosen from the autocomplete dropdown
         */
        var getPlaceDetails = function (list) {
          // Set default fields to be returned
          var request = {
            fields: defaultPlacesFields,
          };

          if (scope.placeId) {
            request['placeId'] = scope.placeId;
          }

          if (list) {
            request['reference'] = list[0].reference;
          }

          var placesService = new google.maps.places.PlacesService(element[0]);
          placesService.getDetails(request,
            function detailsresult(detailsResult, placesServiceStatus) {

              if (placesServiceStatus == google.maps.GeocoderStatus.OK) {
                scope.$apply(function () {

                  controller.$setViewValue(detailsResult.formatted_address);
                  element.val(detailsResult.formatted_address);

                  scope.details = detailsResult;

                  //on focusout the value reverts, need to set it again.
                  var watchFocusOut = element.on('focusout', function (event) {
                    element.val(detailsResult.formatted_address);
                    element.unbind('focusout');
                  });

                });
              }
            }
          );
        }

        controller.$render = function () {
          var location = controller.$viewValue;
          element.val(location);
        };

        //watch options provided to directive
        scope.watchOptions = function () {
          return scope.options;
        };
        scope.watchPlace = function () {
          return scope.placeId;
        };
        scope.watchAddress = function () {
          return scope.initialAddress;
        };
        scope.$watch(scope.watchOptions, function () {
          initOpts();
        }, true);

        scope.$watch(scope.watchPlace, function () {
          initPlace();
        }, true);

        scope.$watch(scope.watchAddress, function () {
          initInitialAddress();
        }, true);

        scope.$on('ngPlacesAutocomplete:submit', function (event, data) {
            google.maps.event.trigger(scope.gPlace, 'place_changed');
        });
      }
    };
  });
