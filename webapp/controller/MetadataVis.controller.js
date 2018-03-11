sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/ValueState",
	"sap/ui/core/util/File"
], function(BaseController, JSONModel, Filter, FilterOperator, ValueState, File) {
	"use strict";

	return BaseController.extend("de.blogspot.openui5.odata.explorer.controller.MetadataVis", {

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function() {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				source: "atomicCircle",
				orientation: "LeftRight",
				arrowPosition: "End",
				arrowOrientation: "ParentOf",
				nodeSpacing: 40,
				nodePlacement: "Simple",
				mergeEdges: false
			});
			this.setModel(oViewModel, "ui");
			this._oViewModel = oViewModel;

			// graph model must be root!!!
			this._oGraphModel = new JSONModel();

			// oData MetaData handling
			//this._oODataModel = this.getOwnerComponent().getModel();
			this._oODataModel = sap.ui.getCore().getModel("odata");
			
			if (this._oODataModel) {
				this._oODataModel.metadataLoaded().then(function() {
					this._setSchema(this._oODataModel.getServiceMetadata());
				}.bind(this));
			}
		},
		
		onAfterRendering: function() {
			// delay model set for renderung issue of network control
			this.getView().setModel(this._oGraphModel);
		},

		/* =========================================================== */
		/* event handler                                               */
		/* =========================================================== */

		onExportPng: function() {
			// loading indicator
			this._oViewModel.setProperty("/busy", true);

			this.exportSvg(function(domCopy, domSvg) {
				// render PNG
				var canvas = document.createElement("canvas");
				var bbox = domSvg.getBBox();
				canvas.width = bbox.width;
				canvas.height = bbox.height;
				var ctx = canvas.getContext("2d");
				ctx.fillStyle = "#ffffff";
				//ctx.clearRect(0, 0, bbox.width, bbox.height);
				ctx.fillRect(0, 0, bbox.width, bbox.height);

				var data = (new XMLSerializer()).serializeToString(domCopy);
				var DOMURL = window.URL || window.webkitURL || window;
				var img = new Image();
				var svgBlob = new Blob([data], {
					type: "image/svg+xml;charset=utf-8"
				});
				var url = DOMURL.createObjectURL(svgBlob);
				img.onload = function() {
					// loading indicator
					this._oViewModel.setProperty("/busy", false);

					ctx.drawImage(img, 0, 0);
					DOMURL.revokeObjectURL(url);
					var imgURI = canvas.toDataURL("image/png");
					//.replace("image/png", "image/octet-stream");
					//window.location.href = imgURI;
					File.save(this._dataURItoBlob(imgURI, "image/png"), "OData-Model", "png", "image/png", "utf-8");

					document.removeChild(canvas);
				}.bind(this);
				img.src = url;

				// loading indicator
				this._oViewModel.setProperty("/busy", false);
			}.bind(this));
		},

		onExportSvg: function() {
			// loading indicator
			this._oViewModel.setProperty("/busy", true);

			this.exportSvg(function(domCopy, domSvg) {
				var sData = (new XMLSerializer()).serializeToString(domCopy);
				File.save(sData, "OData-Model", "svg", "image/svg+xml", "utf-8");

				// loading indicator
				this._oViewModel.setProperty("/busy", false);
			}.bind(this));
		},
		
		onDisplay: function() {
			this.display("metadata");
		},

		/* =========================================================== */
		/* public method                                               */
		/* =========================================================== */

		exportSvg: function(fnCallback) {
			var domSvg = this.getView().byId("graph").$().find("svg")[0],
				domCopy = domSvg.cloneNode(true);

			// apply inline CSS styles
			this._copyStylesInline(domCopy, domSvg);

			fnCallback(domCopy, domSvg);
		},

		formatIntValue: function(sValue) {
			return parseInt(sValue, 10);
		},

		formatBoolValue: function(sValue) {
			return (sValue === "1");
		},

		formatPropertyName: function(sEntityType, sProperty) {
			return this.getText("@" + sEntityType + ((sProperty) ? sProperty : ""));
		},

		/* =========================================================== */
		/* private method                                              */
		/* =========================================================== */

		_resolveAliasName: function(sName) {
			return (sName) ? sName.substr(sName.lastIndexOf(".") + 1) : sName;
		},

		_setGraphModel: function(oSchema) {
			var that = this,
				aAssociation = oSchema.association,
				//aKeys, sType,
				aKeys,
				aNodes = [],
				aAttributes = [],
				aLines = [],
				aLineKeys = [];

			if (oSchema.entityType) {
				oSchema.entityType.forEach(function(oEntity) {
					aKeys = [];
					aAttributes = [];

					// keys
					oEntity.key.propertyRef.forEach(function(oKey) {
						aKeys.push(oKey.name);
					});

					// iterate property(s)
					if (oEntity.property) {
						oEntity.property.forEach(function(oProperty) {
							// defaults
							oProperty.label = "-";

							if (oProperty.extensions) {
								oProperty.extensions.forEach(function(oExtension) {
									switch (oExtension.name) {
										case "label":
											oProperty.label = oExtension.value;
											break;
									}
								});
							}

							//sType = (oProperty.type === "Edm.String") ? "" : (" (" + oProperty.type.substr(4) + ")");

							aAttributes.push({
								//"label": that.getText(oProperty.label.substr(7, oProperty.label.length - 1 - 7)),
								//"label": oProperty.name + sType,
								"label": oProperty.name,
								"value": oProperty.type.substr(4)
								//"value": that.getText(oProperty.label.substr(7, oProperty.label.length - 1 - 7))
							});
						});
					}

					aAttributes.push({
						"label": ""
					});

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

								// resolve start type
								var aEndTarget = jQuery.grep(oAssociation.end, function(oEnd) {
									return oEnd.role === oNavigationProperty.fromRole;
								});

								if (aEndTarget && aEndTarget.length > 0) {
									oNavigationProperty.fromType = that._resolveAliasName(aEndTarget[0].type);
								}

								// resolve end type
								aEndTarget = jQuery.grep(oAssociation.end, function(oEnd) {
									return oEnd.role === oNavigationProperty.toRole;
								});

								if (aEndTarget && aEndTarget.length > 0) {
									oNavigationProperty.toType = that._resolveAliasName(aEndTarget[0].type);
								}

								if (aLineKeys.indexOf(oNavigationProperty.fromRole + "_" + oNavigationProperty.toRole) === -1) {
									aLines.push({
										from: oNavigationProperty.fromType,
										to: oNavigationProperty.toType
									});
									aLineKeys.push(oNavigationProperty.fromRole + "_" + oNavigationProperty.toRole);
									aAttributes.push({
										label: oNavigationProperty.name,
										value: oNavigationProperty.toType
									});
								}
							}
						});
					}

					aNodes.push({
						"key": oEntity.name,
						//"title": oEntity.name + " (" + aKeys.join(",") + ")",
						"title": oEntity.name,
						//"description": that.getText("@" + oEntity.name.toString() + "TypeDescription"),
						"description": aKeys.join(","),
						"icon": "sap-icon://form",
						"shape": "Box",
						"status": "Success",
						"attributes": aAttributes
					});
				});
			}

			this._oGraphModel.setProperty("/nodes", aNodes);
			this._oGraphModel.setProperty("/lines", aLines);
			//console.log("oSchema", oSchema, aNodes, aLines, this._oGraphModel);
		},

		_copyStylesInline: function(destinationNode, sourceNode) {
			var containerElements = ["svg", "g"];

			for (var cd = 0; cd < destinationNode.childNodes.length; cd++) {
				var child = destinationNode.childNodes[cd];

				// hide ui action buttons
				if (child.attributes.class && child.attributes.class.value === "sapSuiteUiCommonsNetworkNodeInfoWrapper") {
					child.style.setProperty("display", "none");
				}

				if (containerElements.indexOf(child.tagName) !== -1) {
					this._copyStylesInline(child, sourceNode.childNodes[cd]);
					continue;
				}
				var style = sourceNode.childNodes[cd].currentStyle || window.getComputedStyle(sourceNode.childNodes[cd]);
				if (style === "undefined" || style == null) {
					continue;
				}

				for (var st = 0; st < style.length; st++) {
					//console.log("style", style[st], style.getPropertyValue(style[st]));
					child.style.setProperty(style[st], style.getPropertyValue(style[st]));
				}
			}
		},

		_dataURItoBlob: function(dataURI, sMime) {
			var byteString = atob(dataURI.split(",")[1]);
			var ab = new ArrayBuffer(byteString.length);
			var ia = new Uint8Array(ab);
			for (var i = 0; i < byteString.length; i++) {
				ia[i] = byteString.charCodeAt(i);
			}
			return new Blob([ab], {
				type: sMime
			});
		},

		_setSchema: function(oServiceMetadata) {
			var oSchema = oServiceMetadata.dataServices.schema[0];

			this._setGraphModel(oSchema);
		}

	});
});