/**
 * Unified Base Controller
 *
 * @namespace
 * @name ips.ac.controller.scfld.BaseController
 * @public
 */
/*global history */
sap.ui.define([
	"jquery.sap.global",
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History",
	"sap/ui/Device"
], function(jQuery, Controller, History, Device) {
	"use strict";

	/**
	 * Constructor for a new BaseController.
	 *
	 * @param {string} [sServiceUrl] base uri of the service to request data from; additional URL parameters appended here will be appended to every request
	 * 								can be passed with the mParameters object as well: [mParameters.serviceUrl] A serviceURl is required!
	 * @param {object} [mParameters] (optional) a map which contains the following parameter properties:
	 * @param {string} [mParameters.routeName] the name of the used route
	 *
	 * @class
	 * Base Controller implementation
	 *
	 * @extends sap.ui.core.mvc.Controller
	 *
	 * @author UNIORG
	 * @version 1.0.0
	 *
	 * @constructor
	 * @public
	 * @alias bonvendo2.ui.core.mvc.controller.BaseController
	 */
	return Controller.extend("ips.ac.controller.scfld.de.blogspot.openui5.odata.explorer.controller.BaseController", /** @lends ips.ac.controller.scfld.BaseController.prototype */ {

		/* =========================================================== */
		/* event handler                                               */
		/* =========================================================== */

		onOpenFragmentPopup: function(oEvent) {
			var oSource = oEvent.getSource(),
				oDomRef = oEvent.getParameter("domRef"),
				sName = oSource.data("fragmentName"),
				oFragment = this.getXmlFragment(sName);

			// delay because addDependent (inside getFragement) will do a async rerendering and the popover will immediately close without it
			jQuery.sap.delayedCall(0, this, function() {
				if (oFragment.openBy) {
					// popover
					oFragment.openBy((oDomRef) ? oDomRef : oSource);
				} else {
					// dialog
					oFragment.open();
				}
			});
		},

		onClosePopup: function(oEvent, oTarget) {
			// TODO: handle ResponsivePopups (workaround: oTarget = oEvent.getSource().getParent())
			var oNode = (oTarget) ? oTarget : oEvent.getSource();

			while (oNode !== null && !oNode.close) {
				oNode = oNode.getParent();
			}

			if (oNode && oNode.close) {
				oNode.close();
			}
		},

		/**
		 * Event handler  for navigating back.
		 * It checks if there is a history entry. If yes, history.go(-1) will happen.
		 * If not, it will replace the current entry of the browser history with the master route.
		 * @public
		 */
		onNavBack: function() {
			// in some cases we could display a certain target when the back button is pressed
			if (this._oDisplayData && this._oDisplayData.fromTarget) {
				this.display(this._oDisplayData.fromTarget);
				delete this._oDisplayData.fromTarget;
				return;
			}

			var oHistory = History.getInstance();
			var sPreviousHash = oHistory.getPreviousHash();

			if (sPreviousHash !== undefined) {
				// The history contains a previous entry
				//window.history.go(-1);
				this.historyGo(-1);
			} else {
				//this.getRouter().navTo("welcome", false);
				this.navTo("welcome", false);
			}
		},

		/**
		 * Event handler for navigating to defined route.
		 * You have to define a custom data route name property
		 * e.g. XMLView -> data:routeName="routeName"
		 * e.g. JSView  -> customData : [{ key : "routeName", value : "routeName" }]
		 *
		 * @param {sap.ui.base.Event} oEvent - the navigate to event.
		 * @returns {undefined} undefined
		 * @public
		 */
		onNavTo: function(oEvent) {
			var oItem = oEvent.getParameter("listItem") || oEvent.getParameter("item") || oEvent.getSource(),
				sRouteName = oItem.data("routeName") || oItem.data("route"),
				oRouteConfig = oItem.data("routeConfig") || {},
				sUrl = oItem.data("url") || undefined;

			// route handling
			if (sRouteName) {
				// nav to with history
				this.navTo(sRouteName, oRouteConfig, false);
			} else if (sUrl && sUrl.length > 0) {
				//window.open(sUrl);
				sap.m.URLHelper.redirect(sUrl, true);
			}
		},

		/* =========================================================== */
		/* public methods                                              */
		/* =========================================================== */

		getComponent: function() {
			return sap.ui.core.Component.getOwnerComponentFor(
				this.getView()
			);
		},

		/**
		 * Convenience method for getting the view model by name in every controller of the application.
		 * @public
		 * @param {string} sName the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function(sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Convenience method for setting the view model in every controller of the application.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel: function(oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		/**
		 * Convenience method for getting the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle: function() {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		/**
		 * Convenience method for accessing the router in every controller of the application.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */
		getRouter: function() {
			return this.getOwnerComponent().getRouter();
		},

		/**
		 * Convenience method for getting the resource bundle text.
		 * @public
		 * @param {string} sKey  the property to read
		 * @param {string[]} aArgs? List of parameters which should replace the place holders "{n}" (n is the index) in the found locale-specific string value.
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */
		getText: function(sKey, aArgs) {
			return this.getResourceBundle().getText(sKey, aArgs);
		},

		/**
		 * Convenience method for loading and caching view fragments in every controller of the application.
		 * @param {string} [sId] id of the newly created Fragment
		 * @param {string | object} vFragment name of the Fragment (or Fragment configuration as described above, in this case no sId may be given. 
		 *                          Instead give the id inside the config object, if desired)
		 * @param {sap.ui.core.mvc.Controller} [oController] a Controller to be used for event handlers in the Fragment
		 * @public
		 * @static
		 * @return {sap.ui.core.Control|sap.ui.core.Control[]} the root Control(s) of the created Fragment instance
		 */
		getXmlFragment: function(sId, vFragment, oController) {
			var bWithId = (typeof(sId) === "string" && typeof(vFragment) === "string"),
				sName = (bWithId) ? vFragment : sId,
				sPrefix = sName.substr(0, 1),
				oView = this.getView(),
				sViewId = oView.getId();

			// relative fragment name handling
			if (sPrefix === ".") {
				// resolve view relative path
				var sViewName = oView.getViewName(),
					iLastDotPos = sViewName.lastIndexOf("."),
					sPackage = sViewName.substr(0, iLastDotPos);
				sName = sPackage + sName;
			} else if (sPrefix === "/") {
				// resolve component relative path
				var sComponentName = this.getComponent().getMetadata().getComponentName();
				sName = sComponentName + ".view" + sName;
			}

			// lazy load fragment
			var sFragmentId = (bWithId) ? sId : sViewId,
				sCacheId = sFragmentId + "--" + sName,
				oCmp = this.getComponent();

			// initialize cache on first call	
			if (!oCmp._aFragments) {
				oCmp._aFragments = [];
			}

			// make sure cache is existent
			if (!oCmp._mFragments) {
				oCmp._mFragments = {};
			}

			// instantiate fragment if not in cache
			if (!oCmp._mFragments[sCacheId]) {
				if (oController && typeof oController === "string") {
					/*
					var sCtrlPrefix = oController.substr(0,1);
					if (sCtrlPrefix === "/") {
					    // resolve component relative path
					    oController = sComponentName + ".controller" + oController;
					}
					oController = sap.ui.controller(oController);
					*/
					oController = this;
				} else {
					oController = this;
				}

				// attach owner component reference to controller
				if (!oController.component) {
					oController.component = sap.ui.core.Component.getOwnerComponentFor(oView);
				}

				// instantiate and cache fragment
				oController.component.runAsOwner(function() {
					oCmp._mFragments[sCacheId] = sap.ui.xmlfragment(sFragmentId, sName, oController);
				});

				// add fragment dependency to calling view
				oView.addDependent(oCmp._mFragments[sCacheId]);

				// toggle compact style
				jQuery.sap.syncStyleClass(
					"sapUiSizeCompact", oView, oCmp._mFragments[sCacheId]
				);
			}

			// return cached fragment
			return oCmp._mFragments[sCacheId];

		}, // eof getXmlFragment  		

		display: function(sRoute, mData) {
			// navigate to event target
			this.getRouter().getTargets().display(sRoute, mData);
		},

		historyGo: function(iSteps) {
			// navigate to event target
			window.history.go(iSteps);
		},

		navTo: function(sRoute, mData, bReplace) {
			// navigate to event target
			this.getRouter().navTo(sRoute, mData, bReplace);
		}

	});

});