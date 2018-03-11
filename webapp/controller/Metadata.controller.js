sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/odata/v2/ODataModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/ValueState",
	"sap/m/MessageBox"
], function(BaseController, JSONModel, ODataModel, Filter, FilterOperator, ValueState, MessageBox) {
	"use strict";

	return BaseController.extend("de.blogspot.openui5.odata.explorer.controller.Metadata", {

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		// set to true to enable catalog search on SAP GW
		// also add corresponding manifest.json section
		_bUseCatalogService: false,

		onInit: function() {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				showSideContent: true,
				useCatalogService: this._bUseCatalogService,
				showSapAnnotations: false,
				showExtensions: false,
				schema: null,
				serviceUrl: null,
				serviceName: null,
				serviceCount: null,
				entityType: null,
				entityCount: null
			});
			this.getView().setModel(oViewModel, "ui");
			this._oViewModel = oViewModel;

			// shortcuts
			this._oObjectPageLayout = this.getView().byId("ObjectPageLayout");
			this._oDynamicSideView = this.getView().byId("DynamicSideContent");
			this._oEntityTypeList = this.getView().byId("EntityTypeList");
			this._oOPSideContentBtn = this.getView().byId("headerForTest").getSideContentButton();

			// handle nav to EntityType
			this.getRouter().getRoute("metadata").attachPatternMatched(this._onObjectMatched, this);

			// load northwind demo service
			// http://services.odata.org/V2/Northwind/Northwind.svc
			if (!this._bUseCatalogService) {
				this._loadService("/northwind/V2/Northwind/Northwind.svc/", "Northwind v2");
			}
		},

		onAfterRendering: function() {
			this._sCurrentBreakpoint = this._oDynamicSideView.getCurrentBreakpoint();
		},

		/* =========================================================== */
		/* event handler                                               */
		/* =========================================================== */
		
		onDisplayVis: function() {
			this.display("visualizer");
		},

		onBreakpointChanged: function(oEvent) {
			var sCurrentBreakpoint = oEvent.getParameter("currentBreakpoint");

			if (sCurrentBreakpoint === "S" || !this._oDynamicSideView.getShowSideContent()) {
				this._oOPSideContentBtn.setVisible(true);
			} else {
				this._oOPSideContentBtn.setVisible(false);
			}
		},

		onEntityTypeListUpdateFinished: function(oEvent) {
			var oList = oEvent.getSource(),
				aItems = oList.getItems(),
				iTotal = oEvent.getParameter("total");

			// set count
			this._oViewModel.setProperty("/entityCount", iTotal);

			if (aItems.length > 0) {
				if (this._sSelectedEntityType) {
					this.selectEntityType(this._sSelectedEntityType);
				} else {
					// navigate to select entity
					this.navToEntityType(aItems[0].getBindingContext("ui").getProperty("name"));
				}

				// do not handle further events (only select first time data is available)
				//oList.detachUpdateFinished(this.onEntityTypeListUpdateFinished, this);
			}
		},
		
		onSetServiceUrl: function(oEvent) {
			var sServiceUrl = this._oViewModel.getProperty("/serviceUrl");

			if (sServiceUrl && sServiceUrl.length > 0) {
				this._loadService(sServiceUrl, "Custom");
			}
		},

		onServiceListUpdateFinished: function(oEvent) {
			var oList = oEvent.getSource(),
				aItems = oList.getItems(),
				iTotal = oEvent.getParameter("total");

			// set count
			this._oViewModel.setProperty("/serviceCount", iTotal);

			if (aItems.length > 0) {
				/*
				if (this._sSelectedEntityType) {
					this.selectEntityType(this._sSelectedEntityType);
				} else {
					// navigate to select entity
					this.navToEntityType(aItems[0].getBindingContext("ui").getProperty("name"));
				}
				*/

				// do not handle further events (only select first time data is available)
				oList.detachUpdateFinished(this.onServiceListUpdateFinished, this);
			}
		},

		onEntityTypeSelection: function(oEvent) {
			var oItem = oEvent.getParameter("listItem"),
				oContext = oItem.getBinding("title").getContext();

			this.navToEntityType(oContext.getProperty("name"));
		},

		onPopupEntityTypeSelection: function(oEvent) {
			var oItem = oEvent.getParameter("listItem"),
				oContext = oItem.getBinding("title").getContext();

			this.navToEntityType(oContext.getProperty("name"));

			// oTarget workaround for ResponsivePopup
			this.onClosePopup(oEvent, oEvent.getSource().getParent());
		},

		onPopupServiceSelection: function(oEvent) {
			var oItem = oEvent.getParameter("listItem"),
				oContext = oItem.getBinding("title").getContext();

			this._loadService(oContext.getProperty("ServiceUrl"), oContext.getProperty("TechnicalServiceName"));

			// oTarget workaround for ResponsivePopup
			this.onClosePopup(oEvent, oEvent.getSource().getParent());
		},

		onNavigateToEntityType: function(oEvent) {
			var oItem = oEvent.getParameter("listItem") || oEvent.getSource(),
				oContext = oItem.getBindingContext("ui");

			//this.navToEntityType(oContext.getProperty("toRole"));
			this.navToEntityType(oContext.getProperty("toType"));
		},

		onSearch: function(oEvent) {
			this._search(oEvent, this._oEntityTypeList, "name");
		},

		onPopupSearch: function(oEvent) {
			this._search(oEvent, this.getView().byId("PopupEntityTypeList"), "name");
		},

		onServiceSearch: function(oEvent) {
			this._search(oEvent, this.getView().byId("PopupServiceList"), "TechnicalServiceName");
		},

		onSideContentHide: function() {
			if (this._sCurrentBreakpoint === "S") {
				this._oDynamicSideView.toggle();
			} else {
				this._oDynamicSideView.setShowSideContent(false);
			}
			this._oOPSideContentBtn.setVisible(true);
		},

		onSCBtnPress: function(oEvent) {
			if (this._sCurrentBreakpoint === "S") {
				this._oDynamicSideView.toggle();
			} else {
				this._oDynamicSideView.setShowSideContent(true);
			}
			this._oOPSideContentBtn.setVisible(false);
		},

		onTop: function() {
			this._oObjectPageLayout._getCustomScrollBar().setScrollPosition(0);
		},

		/* =========================================================== */
		/* public method                                               */
		/* =========================================================== */

		formatEntityDescription: function(sEntityType) {
			return this.getText("@" + sEntityType + "TypeDescription");
		},

		formatPropertyName: function(sEntityType, sProperty) {
			//return this.getText("@" + sEntityType + ((sProperty) ? sProperty : ""));
			return sProperty;
		},

		formatPropertyState: function(sEntityType, sProperty) {
			var sText = this.getText("@" + sEntityType + ((sProperty) ? sProperty : ""));

			if (sText.indexOf("@") !== -1) {
				return ValueState.Error;
			} else if (sText === sProperty) {
				return ValueState.Warning;
			} else {
				return ValueState.None;
			}
		},

		navToEntityType: function(sEntityType) {
			this.navTo("metadata", {
				entityType: sEntityType
			});
		},

		selectEntityType: function(sEntityType) {
			this._selectEntityType(sEntityType, this._oEntityTypeList, true);
			this._selectEntityType(sEntityType, this.getView().byId("PopupEntityTypeList"), false);
		},

		/* =========================================================== */
		/* private method                                              */
		/* =========================================================== */

		_bindPanel: function(sPath) {
			var oElement = this.getView().byId("ObjectPageLayout").bindElement({
				path: sPath,
				model: "ui"
			});

			this._oViewModel.setProperty("/entityType", oElement.getElementBinding("ui").getBoundContext().getProperty("name"));
		},

		_loadService: function(sServiceUrlAbsolute, sServiceName) {
			var sServiceUrl = sServiceUrlAbsolute,
				iSapPos = sServiceUrlAbsolute.indexOf("/sap/opu/");

			// make sap uri server relative for use inside service batchMode=false
			if (iSapPos !== -1) {
				sServiceUrl = sServiceUrlAbsolute.substr(iSapPos);
			}

			this._oViewModel.setProperty("/busy", true);
			this._oViewModel.setProperty("/serviceUrl", sServiceUrl);

			// unset selection
			this._sSelectedEntityType = null;

			//this._oODataModel = this.getOwnerComponent().getModel();
			this._oODataModel = new ODataModel(sServiceUrl, {
				//tokenHandling: false,
				//disableHeadRequestForToken: true
			});

			// handle metadata load
			this._oODataModel.metadataLoaded().then(function() {
				this._setSchema(this._oODataModel.getServiceMetadata());

				this._oViewModel.setProperty("/busy", false);
			}.bind(this));
			this.setModel(this._oODataModel);
			
			sap.ui.getCore().setModel(this._oODataModel, "odata");
			
			// handle metadata error
			this._oODataModel.attachMetadataFailed(function(oEvent) {
				var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;

				//console.log("error", oEvent.getParameters(), oEvent.getParameter("message"));
				MessageBox.error("Service >" + sServiceName + "< konnte nicht geladen werden!", {
					title: oEvent.getParameter("statusText"),
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				});

				this._oViewModel.setProperty("/busy", false);
			}, this);
		},

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			var oParameter = oEvent.getParameter("arguments");
			for (var value in oParameter) {
				oParameter[value] = decodeURIComponent(oParameter[value]);
			}

			if (oParameter.entityType && oParameter.entityType !== "undefined") {
				// mark initial selected
				this._sSelectedEntityType = oParameter.entityType;

				// select entity type in list and set binding
				this.selectEntityType(oParameter.entityType);
			}
		},

		_search: function(oEvent, oList, sFilterProperty) {
			var sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue"),
				aFilter = [];

			if (sQuery && sQuery.length > 0) {
				aFilter.push(new Filter(sFilterProperty, FilterOperator.Contains, sQuery));
				// case insensitive search currently does not work locally!
				//aFilter.push(new Filter("tolower(" + sFilterProperty + ")", FilterOperator.Contains, "'" + sQuery.toLowerCase() + "'"));
			}

			oList.getBinding("items").filter(aFilter, "Application");
		},

		_selectEntityType: function(sEntityType, oList, bBind) {
			if (!oList) {
				return;
			}

			var aItems = oList.getItems();

			// find corresponding item(s)
			var aTarget = jQuery.grep(aItems, function(oItem) {
				return oItem.getTitle() === sEntityType;
			});

			if (aTarget.length > 0) {
				var oItem = aTarget[0];

				// select first list item
				oList.setSelectedItem(oItem, true);

				// set binding 
				if (bBind) {
					this._bindPanel(oItem.getBindingContext("ui").getPath());
				}
			}
		},

		_resolveAliasName: function(sName) {
			return (sName) ? sName.substr(sName.lastIndexOf(".") + 1) : sName;
		},

		_setSchema: function(oServiceMetadata) {
			var that = this,
				oSchema = oServiceMetadata.dataServices.schema[0],
				aAssociation = oSchema.association;

			// transform schema
			if (oSchema.entityType) {
				oSchema.entityType.forEach(function(oEntity) {
					// iterate property(s)
					if (oEntity.property) {
						oEntity.property.forEach(function(oProperty) {
							// defaults
							oProperty.label = "";
							oProperty.creatable = true;
							oProperty.updatable = true;
							oProperty.filterable = true;
							oProperty.sortable = true;

							if (oProperty.extensions) {
								oProperty.extensions.forEach(function(oExtension) {
									switch (oExtension.name) {
										case "label":
											oProperty.label = oExtension.value;
											break;
										case "creatable":
											oProperty.creatable = oExtension.value.indexOf("false") === -1;
											break;
										case "updatable":
											oProperty.updatable = oExtension.value.indexOf("false") === -1;
											break;
										case "filterable":
											oProperty.filterable = oExtension.value.indexOf("false") === -1;
											break;
										case "sortable":
											oProperty.sortable = oExtension.value.indexOf("false") === -1;
											break;
									}
								});
							}
						});
					}

					// iterate navigationProperty(s)
					if (oEntity.navigationProperty && aAssociation && aAssociation.length > 0) {
						oEntity.navigationProperty.forEach(function(oNavigationProperty) {
							var sAssociationName = that._resolveAliasName(oNavigationProperty.relationship);

							// find corresponding item(s)
							var aTarget = jQuery.grep(aAssociation, function(oAssociation) {
								return oAssociation.name === sAssociationName;
							});

							if (aTarget && aTarget.length > 0) {
								var oAssociation = aTarget[0];

								var aEndTarget = jQuery.grep(oAssociation.end, function(oEnd) {
									return oEnd.role === oNavigationProperty.toRole;
								});

								if (aEndTarget && aEndTarget.length > 0) {
									oNavigationProperty.toType = that._resolveAliasName(aEndTarget[0].type);
								}
							}
						});
					}
				});
			}

			//console.log("Schema", oSchema);
			this._oViewModel.setProperty("/schema", oSchema);
		}

	});
});