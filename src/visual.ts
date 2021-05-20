/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";


import { event as d3Event, select as d3Select } from "d3-selection";
const getEvent = () => require("d3-selection").events;
import { textMeasurementService, valueFormatter, stringExtensions, interfaces } from "powerbi-visuals-utils-formattingutils";
import TextProperties = interfaces.TextProperties;
import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import "regenerator-runtime/runtime";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import PrimitiveValue = powerbi.PrimitiveValue;
import Fill = powerbi.Fill;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import ISandBoxExtendedColorPallete = powerbi.extensibility.ISandboxExtendedColorPalette;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import VisualEnumerationInstanceKinds = powerbi.VisualEnumerationInstanceKinds;
import * as d3 from "d3";
import { getValue, getCategoricalObjectValue } from "./objectEnumerationUtility";
import { dataViewObject, dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import {createTooltipServiceWrapper, ITooltipServiceWrapper, TooltipServiceWrapper, touchStartEventName} from "powerbi-visuals-utils-tooltiputils";
import { getFillColorByPropertyName } from "powerbi-visuals-utils-dataviewutils/lib/dataViewObject";
import { settings } from "node:cluster";


type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;
//type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;


/**
 * Interface for the cards model
 * 
 * @interface
 * @property { CardDataPoint[] } dataPoints                 - Set of data points to be rendered
 * @property { CardSettings } settings                     - General settings for every card
 */
interface CardViewModel {
    dataPoints: CardDataPoint[];
    settings: CardSettings;
}

/**
 * Interface for data points
 * 
 * @interface
 * @property { string } color                               - The background data point color
 * @property { PrimitiveValue } title                       - Title for the card data point
 * @property { string[] } fields                            - Names of fields inside the card
 * @property { PrimitiveValue[] } values                    - Values of fields in the card
 * @property { PrimitiveValue} image                        - An optional image in the card
 * @property { TooltipItemFields } tooltips                 - Field to store aditional tooltip items
 * @property { boolean } highlights                         - Boolean indicator of highlighting of values
 * @property { ISelectionId } selectionId                   - Id assigned for visual interaction
 */
interface CardDataPoint {
    color: string;
    title: PrimitiveValue;
    fields: string[];
    values: PrimitiveValue[];
    image?: PrimitiveValue;
    tooltipFields?: string[];
    tooltipValues?: PrimitiveValue[];
    highlights?: boolean;
    selectionId: ISelectionId
}

/**
 * Interface that represents all settings from visual.ts
 * 
 * @interface
 * @property { displayUnits:string } values                 - Format values according to Power BI measure settings
 * @property { mode:string } cardImages                     - Displays the image as a top cover or an icon
 */
interface CardSettings {
    cardBackground: {
        width: number,
        fill: string,
        conditionalFormat: boolean,
        transparency: number,
        border: {
            width: string,
            color: string,
            radius: number
        }
    };

    cardTitle: {
        fontSize: string,
        fontFamily: string,
        fill: string
    };

    cardInformations: {
        fields: {
            fontSize: string,
            fontFamily: string,
            fill: string
        };
        values: {
            fontSize: string,
            fontFamily: string,
            fill: string,
            displayUnits: string,
        };
    }; 

    cardImages: {
        mode: string,
        coverHeight: number
    };
}

/**
 * Interface that represents all cards dimensions
 * 
 * @interface
 */
interface CardsDimensions {
    general: {
        container: {
            width: number
        };

        cards: {
            width: number,
            height: number,
            padding: number,
            margin: number
        };
    };

    content: {
        background: {
            width: number,
            height: number
        };

        inner:{
            width: number,
            height: number
        };
    };

    header: {
        titles: {
            x: number,
            y: number,
            width: number
        };

        images: {
            x: number,
            y: number,
            width: number,
            height: number
        };
    };

    body: {
        informations: {
            heights: number[],
            totalHeight: number,
            y: number
        };
    };
}


function visualTransform(options: VisualUpdateOptions, host: IVisualHost): CardViewModel {
    let viewModel: CardViewModel = {
        dataPoints: [],
        settings: <CardSettings>{}
    }

    let dataView: DataView = options.dataViews[0];
    if(!dataView
        || !dataView
        || !dataView.categorical
        || !dataView.categorical.values
    ) {
        return viewModel;
    }

    const palette: ISandBoxExtendedColorPallete = host.colorPalette;
    let objects = dataView.metadata.objects;

    let cardSettings: CardSettings = {
        cardBackground: {
            width: getValue<number>(objects, 'cards', 'cardWidth', 280),
            fill: getPaletteProperty('background', palette, getValue<string>(objects, 'cards', 'backgroundColor', '#FFFFFF')),
            conditionalFormat: getValue<boolean>(objects, 'cards', 'conditionalFormat', false),
            transparency: getValue<number>(objects, 'cards', 'backgroundTransparency', 0),
            border: {
                width: getPaletteProperty('strokeWidth', palette, getValue<number>(objects, 'cards', 'strokeWidth', 0)) + "px",
                color: getPaletteProperty('foreground', palette, getValue<string>(objects, 'cards', 'borderColor', 'black')),
                radius: d3.max([0, d3.min([15, getValue<number>(objects, 'cards', 'borderRadius', 0)])])
            }
        }, 
        cardTitle: {
            fontSize: getValue<number>(objects, 'cardsTitles', 'titleFontSize', 12) + "pt",
            fontFamily: getValue<string>(objects, 'cardsTitles', 'fontFamily', 'wf_standard-font, helvetica, arial, sans-serif'),
            fill: getPaletteProperty('foreground', palette, getColorString(getValue<string>(objects, 'cardsTitles', 'fontColor', 'black')))
        },
        cardInformations: {
            fields: {
                fontSize: getValue<number>(objects, 'cardsInformations', 'fontSize', 10) + "pt",
                fontFamily: getValue<string>(objects, 'cardsInformations', 'fieldsFontFamily', '\'Segoe UI\', wf_segoe-ui_normal, helvetica, arial, sans-serif'),
                fill: getPaletteProperty('foreground', palette, getColorString(getValue<string>(objects, 'cardsInformations', 'fieldsFontColor', '#666666')))
            },
            values: {
                fontSize: getValue<number>(objects, 'cardsInformations', 'secFontSize', 10) + "pt",
                fontFamily: getValue<string>(objects, 'cardsInformations', 'valuesFontFamily', '\'Segoe UI\', wf_segoe-ui_normal, helvetica, arial, sans-serif'),
                fill: getPaletteProperty('foreground', palette, getColorString(getValue<string>(objects, 'cardsInformations', 'valuesFontColor', 'black'))),
                displayUnits: getValue<string>(objects, 'cardsInformations', 'valuesDisplayUnits', 'Auto')
            }
        },
        cardImages: {
            mode: getValue<string>(objects, 'cardsImages', 'imageMode', 'profile'),
            coverHeight: getValue<number>(objects, 'cardsImages', 'coverImageHeight', 150)
        }   
    }

    let titles = dataView.categorical.categories[0];
    let formatting = titles.objects || null;
    let informations = dataView.categorical.values.filter(value => value.source.roles.informations == true);
    let images = dataView.categorical.values.filter(value => value.source.roles.images == true)[0] || null;
    let tooltips = dataView.categorical.values.filter(value => value.source.roles.tooltips == true);
    let highlights = dataView.categorical.values[0].highlights || null;
    let cardDataPoints: CardDataPoint[] = [];
    
    for (let i = 0; i < titles.values.length; i++) {
        const color: string = formatting && cardSettings.cardBackground.conditionalFormat ? 
            getColorString(<Fill>formatting[i].conditionalFormatting.backgroundColor) : 
            getColorString(cardSettings.cardBackground.fill);

        const selectionId: ISelectionId = host.createSelectionIdBuilder()
            .withCategory(dataView.categorical.categories[0], i)
            .createSelectionId();

        cardDataPoints.push({
            color: color,
            title: formatDataViewValues(titles.values[i], getColumnDataType(titles.source.type), titles.source.format, cardSettings.cardInformations.values.displayUnits),
            fields: informations.map(info => info.source.displayName),
            values: informations.map(info => formatDataViewValues(info.values[i], getColumnDataType(info.source.type), info.source.format, cardSettings.cardInformations.values.displayUnits)),
            image: images ? images.values[i] : null,
            tooltipFields: tooltips ? tooltips.map(tip => tip.source.displayName) : null,
            tooltipValues: tooltips ? tooltips.map(tip => formatDataViewValues(tip.values[i], getColumnDataType(tip.source.type), tip.source.format, cardSettings.cardInformations.values.displayUnits)) : null, 
            highlights: highlights ? !!highlights[i] : true,
            selectionId: selectionId
        });
    }

    return {
        dataPoints: cardDataPoints,
        settings: cardSettings
    }
}


function getColorString(color: Fill | string): string {
    if(typeof(color) === 'string') return color;

    return color.solid.color;
}


function getPaletteProperty(
    elementKind: string, 
    palette: ISandBoxExtendedColorPallete, 
    defaultValue: any
): any {
    if(palette.isHighContrast) {
        switch(elementKind) {
            case 'background':
                return palette.background.value;
            case 'foreground':
                return palette.foreground.value;
            case 'foregroundSelected':
                return palette.foregroundSelected.value;
            case 'strokeWidth':
                return 2;
        }
    };

    return defaultValue;
}


function getColumnDataType(columnTypes: powerbi.ValueTypeDescriptor): string {
    if(columnTypes.bool) return 'bool';
    if(columnTypes.text) return 'text';
    if(columnTypes.numeric) return 'numeric';
    if(columnTypes.dateTime) return 'dateTime';
    if(columnTypes.integer) return 'integer';
    if(columnTypes.duration) return 'duration';
    if(columnTypes.binary) return 'binary';

}

function formatDataViewValues(value: any, type: string, format?: string, displayUnits?: string): any {
    let result: any;
    if (value == null) {
        result = null;
    } else if (type == "numeric" && (format == "0" || format == null)) {
        let iValueFormatter = valueFormatter.create({ value: displayUnits });
        result = iValueFormatter.format(value);
    } else if (format != null && type != 'dateTime') {
        let iValueFormatter = valueFormatter.create({ format: format });
        result = iValueFormatter.format(value);
    } else if (format != null && type == 'dateTime') {
        let iValueFormatter = valueFormatter.create({ format: format });
        result = iValueFormatter.format(d3.isoParse(value));
    } else {
        result = value;
    }

    return stringExtensions.isNullOrEmpty(result) ? '(Blank)' : result;
}


export class Visual implements IVisual {
    private host: IVisualHost;
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private element: HTMLElement;
    private svg: Selection<any>;
    private cardDataPoints: CardDataPoint[];
    private cardSettings: CardSettings;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private isLandingPageOn: boolean;
    private LandingPageRemoved: boolean;
    private LandingPage: Selection<any>;
    private cardSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>


    constructor(options: VisualConstructorOptions) {
        options.element.style.overflowY = 'Auto';
        this.host = options.host;
        this.element = options.element;
        this.events = options.host.eventService;
        
        this.selectionManager = options.host.createSelectionManager();

        this.selectionManager.registerOnSelectCallback(() => { 
            this.syncSelectionState(
                this.cardSelection, 
                <ISelectionId[]>this.selectionManager.getSelectionIds()
            )
        });

        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

        this.svg = d3.select(options.element)
            .append('svg')
            .classed('multiInfoCards', true);
    };


    public update(options: VisualUpdateOptions) { 
        this.events.renderingStarted(options);

        this.HandleLandingPage(options);
        let self: this = this;

        d3.selectAll('.card').remove();
        d3.selectAll('.background').remove();
        d3.selectAll('.image').remove();
        d3.selectAll('.title').remove();
        d3.selectAll('.information-fields').remove();
        d3.selectAll('.information-values').remove();
        
        let viewModel: CardViewModel = visualTransform(options, this.host);
        this.cardSettings = viewModel.settings;
        this.cardDataPoints = viewModel.dataPoints;

        // Having images will impact positioning of several elements, so this will be used further in logical tests
        let hasImages = this.cardDataPoints.filter(p => p.image != null).length;

        // Calculate font heights for each kind of text, so we can set correct spacing between elements
        let titleFontHeight = this.calculateCardTextHeight('Power BI Sample Text', this.cardSettings.cardTitle.fontFamily, this.cardSettings.cardTitle.fontSize);
        let fieldsFontHeight = this.calculateCardTextHeight('Power BI Sample Text', this.cardSettings.cardInformations.fields.fontFamily, this.cardSettings.cardInformations.fields.fontSize);
        let valuesFontHeight = this.calculateCardTextHeight('Power BI Sample Text', this.cardSettings.cardInformations.values.fontFamily, this.cardSettings.cardInformations.values.fontSize);

        // Get all needed sizes for elements in cards
        const dimensions = this.getCardsDimensions(options.viewport.width, hasImages, this.cardSettings.cardImages.mode, titleFontHeight, fieldsFontHeight, valuesFontHeight);


        let container = this.svg
            .attr('height', this.calculateTotalSVGHeight(this.cardDataPoints.length, dimensions.general.cards.width, dimensions.general.cards.height, dimensions.general.container.width))
            .attr('width', dimensions.general.container.width);
        /*
                Now we'll render each card on the screen and all of it's inner elements
        */
        this.cardSelection = container
            .selectAll('.card')
            .data(this.cardDataPoints);

        const cards = this.cardSelection
            .enter()
            .append('g')
            .merge(<any>this.cardSelection);

        cards
            .classed('card', true)
            .attr('transform', (_, i) => this.positionCardInGrid(i, dimensions.general.cards.width, dimensions.general.cards.height, dimensions.general.container.width));

        cards
            .each(function(d) {
                // Creates a background rect for each card
                d3.select(this)
                    .selectAll('.background')
                    .data([{color: d.color, selectionId: d.selectionId}])
                    .enter()
                        .append<SVGElement>('rect')
                        .classed('background', true)
                        .attr('x', dimensions.general.cards.margin)
                        .attr('y', dimensions.general.cards.margin)
                        .attr('height', dimensions.content.background.height)
                        .attr('width', dimensions.content.background.width)
                        .style('fill', d => d.color)
                        .style('opacity', (1 - (self.cardSettings.cardBackground.transparency / 100)))
                        .style('stroke', self.cardSettings.cardBackground.border.color)
                        .style('stroke-width', self.cardSettings.cardBackground.border.width)
                        .attr('rx', self.cardSettings.cardBackground.border.radius);

                // At the top position of the card, each title
                d3.select(this)
                    .selectAll('.title')
                    .data([{title: d.title, selectionId: d.selectionId}])
                    .enter()
                        .append<SVGElement>('text')
                        .classed('title', true)
                        .attr('x', dimensions.header.titles.x)
                        .attr('y', dimensions.header.titles.y)
                        .attr('width', dimensions.header.titles.width)
                        .style('font-size', self.cardSettings.cardTitle.fontSize)
                        .style('font-family', self.cardSettings.cardTitle.fontFamily)
                        .style('fill', self.cardSettings.cardTitle.fill)
                        .text(d => {
                            return self.fitTextInMaxWidth(
                                d.title, 
                                self.cardSettings.cardTitle.fontFamily, 
                                self.cardSettings.cardTitle.fontSize, 
                                dimensions.header.titles.width
                            )
                        });

                // Images if they do exists
                if(hasImages) {
                    d3.select(this)
                        .selectAll('.image')
                        .data([{ image: d.image, selectionId: d.selectionId }])
                        .enter()
                            .append<SVGElement>('svg:image')
                            .classed('image', true)
                            .attr('x', dimensions.header.images.x)
                            .attr('y', dimensions.header.images.y)
                            .attr('height', dimensions.header.images.height)
                            .attr('width', dimensions.header.images.width)
                            .attr('preserveAspectRatio', self.cardSettings.cardImages.mode == 'profile' ? 'xMidYMid meet' : 'xMidYMid slice')
                            .attr('xlink:href', d => d.image);
                }

                // First we position each field name
                d3.select(this)
                    .selectAll('.information-fields')
                    .data(d.fields)
                    .enter()
                        .append<SVGElement>('text')
                        .classed('information-fields', true)
                        .attr('x', dimensions.general.cards.padding)
                        .attr('y', (_, i) => dimensions.body.informations.y + ((i + 1) * fieldsFontHeight) + dimensions.body.informations.heights.slice(0, i).reduce<number>((a: number, b: number) => a + b, 0))
                        .attr('height', dimensions.content.inner.height)
                        .attr('width', dimensions.content.inner.width)
                        .style('font-size', self.cardSettings.cardInformations.fields.fontSize)
                        .style('font-family', self.cardSettings.cardInformations.fields.fontFamily)
                        .style('fill', self.cardSettings.cardInformations.fields.fill)
                        .text((field: string) => 
                            self.fitTextInMaxWidth(
                                field, 
                                self.cardSettings.cardInformations.fields.fontFamily, 
                                self.cardSettings.cardInformations.fields.fontSize, 
                                dimensions.content.inner.width
                            )
                        );


                // Then each of its values
                d3.select(this)
                    .selectAll('.information-values')
                    .data(d.values)
                    .enter()
                        .append<SVGElement>('text')
                        .classed('information-values', true)
                        .attr('x', dimensions.general.cards.padding)
                        .attr('y', (_, i) => dimensions.body.informations.y + valuesFontHeight + ((i + 1) * fieldsFontHeight) + dimensions.body.informations.heights.slice(0, i).reduce<number>((a: number, b: number) => a + b, 0))
                        .attr('height', dimensions.content.inner.height)
                        .attr('width', dimensions.content.inner.width)
                        .style('font-size', self.cardSettings.cardInformations.values.fontSize)
                        .style('font-family', self.cardSettings.cardInformations.values.fontFamily)
                        .style('fill', self.cardSettings.cardInformations.values.fill)
                        .html((value: any) => {
                            return self.fitMultiLineLongText(
                                value, 
                                self.cardSettings.cardInformations.values.fontFamily,
                                self.cardSettings.cardInformations.values.fontSize,
                                dimensions.general.cards.padding, 
                                dimensions.content.inner.width, 
                                valuesFontHeight
                            )
                        });
            });

            this.tooltipServiceWrapper.addTooltip(
                cards,
                (datapoint: CardDataPoint) => this.getTooltipData(datapoint),
                (datapoint: CardDataPoint) => datapoint.selectionId,
                false
            );

            this.syncSelectionState(
                cards, 
                <ISelectionId[]>this.selectionManager.getSelectionIds()
            );

            // Support highlight
            cards
                .each(function(d) {
                    d3.select(this).style('opacity', self.changeOpacityOnHighlight(d.highlights));
                });

            // Add listeners for tooltips and selection
            cards
                .on('click', d => {
                    if(this.host.allowInteractions) {
                        const isCtrlPressed: boolean = (<MouseEvent>d3Event).ctrlKey;

                        this.selectionManager
                            .select(d.selectionId, isCtrlPressed)
                            .then((ids: ISelectionId[]) => {
                                this.syncSelectionState(cards, ids);
                            });

                        (<Event>d3Event).stopPropagation;
                    }
                });

            this.cardSelection
                .exit()
                .remove();

            this.svg.on('contextmenu', () => {
                const mouseEvent: MouseEvent = d3.event as MouseEvent;
                const eventTarget: EventTarget = mouseEvent.target;
                let dataPoint: any = d3.select(<d3.BaseType>eventTarget).datum();

                this.selectionManager.showContextMenu(dataPoint ? dataPoint.selectionId : {}, {
                    x: mouseEvent.clientX,
                    y: mouseEvent.clientY
                });
                mouseEvent.preventDefault();
            });

            this.events.renderingFinished(options);
    } 



    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnum: VisualObjectInstance[] = [];

        if(!this.cardSettings) return objectEnum;

        switch(objectName) {
            case 'cards':
                objectEnum.push({
                    objectName: objectName,
                    properties: {
                        cardWidth: this.cardSettings.cardBackground.width,
                        backgroundColor: this.cardSettings.cardBackground.fill,
                        conditionalFormat: this.cardSettings.cardBackground.conditionalFormat,
                        backgroundTransparency: this.cardSettings.cardBackground.transparency,
                        strokeWidth: parseInt(this.cardSettings.cardBackground.border.width, 10),
                        borderColor: this.cardSettings.cardBackground.border.color,
                        borderRadius: this.cardSettings.cardBackground.border.radius
                    },
                    selector: null
                });
                break;
            case 'conditionalFormatting':
                if(this.cardSettings.cardBackground.conditionalFormat) {
                    objectEnum.push({
                        objectName: objectName,
                        properties: {
                            backgroundColor: 'white'
                        },
                        propertyInstanceKind: {
                            backgroundColor: VisualEnumerationInstanceKinds.Rule
                        },
                        altConstantValueSelector: this.cardDataPoints.map(p => p.selectionId.getSelector()),
                        selector: dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals)
                    });
                }
                break;
            case 'cardsTitles':
                objectEnum.push({
                    objectName: objectName,
                    properties: {
                        titleFontSize: parseInt(this.cardSettings.cardTitle.fontSize, 10),
                        fontFamily: this.cardSettings.cardTitle.fontFamily,
                        fontColor: this.cardSettings.cardTitle.fill
                    },
                    selector: null
                });
                break;
            case 'cardsInformations':
                objectEnum.push({
                    objectName: objectName,
                    properties: {
                        fontSize: parseInt(this.cardSettings.cardInformations.fields.fontSize, 10),
                        fieldsFontFamily: this.cardSettings.cardInformations.fields.fontFamily,
                        fieldsFontColor: this.cardSettings.cardInformations.fields.fill,
                        secFontSize: parseInt(this.cardSettings.cardInformations.values.fontSize, 10),
                        valuesFontFamily: this.cardSettings.cardInformations.values.fontFamily,
                        valuesFontColor: this.cardSettings.cardInformations.values.fill,
                        valuesDisplayUnits: this.cardSettings.cardInformations.values.displayUnits
                    },
                    selector: null
                });
                break;
            case 'cardsImages':
                objectEnum.push({
                    objectName: objectName,
                    properties: {
                        imageMode: this.cardSettings.cardImages.mode,
                        coverImageHeight: this.cardSettings.cardImages.coverHeight
                    },
                    selector: null
                });
                break;
        }

        return objectEnum;
    }


    // My own methods to deal with sizing stuff
    private getCardsDimensions(viewportWidth: number, hasImages: number, imageMode: string, titlesHeight: number, fieldsHeight: number, valuesHeight: number): CardsDimensions {
        let dimensions: CardsDimensions = {
            general: {
                container: {
                    width: viewportWidth
                },
                cards: {
                    width: 0, height: 0, padding: 15, margin: 5
                }
            },
            content: {
                background: {
                    width: 0, height: 0
                },        
                inner:{
                    width: 0, height: 0
                },
            },        
            header: {
                titles: {
                    x: 0, y: 0, width: 0
                },
                images: {
                    x: 0, y: 0, width: 0, height: 0
                }
            },        
            body: {
                informations: {
                    heights: [], totalHeight: 0, y: 0
                }
            }
        };

        if(!viewportWidth
        || !this.cardDataPoints
        || !this.cardSettings
        ) return dimensions;
            

        dimensions.general.cards.width = d3.min([d3.max([150, this.cardSettings.cardBackground.width]), 1200]);
        dimensions.general.container.width = d3.max([dimensions.general.cards.width, viewportWidth])
        dimensions.content.background.width = dimensions.general.cards.width - (2 * dimensions.general.cards.margin);
        dimensions.content.inner.width = dimensions.general.cards.width - (2 * dimensions.general.cards.padding);
        

        // Gets the needed height to display each block of information
        const informationHeights = this.cardDataPoints.map(p => 
            this.calculateInformationHeights(p, this.cardSettings.cardInformations.values.fontFamily, this.cardSettings.cardInformations.values.fontSize, dimensions.content.inner.width, valuesHeight)
        );
        dimensions.body.informations.heights = d3.transpose(informationHeights).map(i => i.reduce<number>((a: number, b: number) => a > b ? a : b, 0) + 5);
        dimensions.body.informations.totalHeight = dimensions.body.informations.heights.reduce<number>((a: number, b:number) => a + b, 0)

        if(hasImages) {
            if(imageMode == 'profile') {

                dimensions.header.images.x = dimensions.general.cards.padding;
                dimensions.header.images.y = dimensions.general.cards.padding;
                dimensions.header.images.width = 24 * (0.5 + Math.floor(dimensions.general.cards.width / 100));
                dimensions.header.images.height = 24 * (0.5 + Math.floor(dimensions.general.cards.width / 100));
                

                dimensions.general.cards.height = 30 + dimensions.body.informations.totalHeight
                                                + (fieldsHeight * this.cardDataPoints[0].fields.length)
                                                + d3.max([titlesHeight, dimensions.header.images.height])
                                                + valuesHeight;

                dimensions.header.titles.width = dimensions.content.inner.width - dimensions.header.images.width - 20;
                dimensions.header.titles.x = dimensions.general.cards.padding + 10 + dimensions.header.images.width;
                dimensions.header.titles.y = (dimensions.header.images.height + dimensions.general.cards.padding) / 2 + (titlesHeight / 2)
                dimensions.body.informations.y = dimensions.general.cards.padding + d3.max([dimensions.header.images.height, titlesHeight]);
            
            } else {
                
                dimensions.header.images.x = dimensions.general.cards.margin;
                dimensions.header.images.y = dimensions.general.cards.margin + this.cardSettings.cardBackground.border.radius;
                dimensions.header.images.width = dimensions.content.background.width;
                dimensions.header.images.height = d3.max([40, d3.min([this.cardSettings.cardImages.coverHeight, 480])]) - this.cardSettings.cardBackground.border.radius;

                dimensions.general.cards.height = 30 + dimensions.body.informations.totalHeight
                                                + (fieldsHeight * this.cardDataPoints[0].fields.length)
                                                + dimensions.header.images.y
                                                + dimensions.header.images.height
                                                + titlesHeight + valuesHeight;

                dimensions.header.titles.width = dimensions.content.inner.width;
                dimensions.header.titles.x = dimensions.general.cards.padding;
                dimensions.header.titles.y = dimensions.general.cards.padding + dimensions.header.images.y + dimensions.header.images.height + titlesHeight;
                dimensions.body.informations.y = dimensions.general.cards.padding + dimensions.header.images.y + dimensions.header.images.height + titlesHeight + 10;
                
            }
        } else {

            dimensions.general.cards.height = 30 + dimensions.body.informations.totalHeight
                                            + (fieldsHeight * this.cardDataPoints[0].fields.length)
                                            + titlesHeight + valuesHeight;

            dimensions.header.titles.width = dimensions.content.inner.width;
            dimensions.header.titles.x = dimensions.general.cards.padding;
            dimensions.header.titles.y = dimensions.general.cards.padding + titlesHeight;
            dimensions.body.informations.y = dimensions.general.cards.padding + titlesHeight + 10;
        
        }
       
        dimensions.content.background.height = dimensions.general.cards.height - (2 * dimensions.general.cards.margin);
        dimensions.content.inner.height = dimensions.general.cards.height - (2 * dimensions.general.cards.margin);
        
        return dimensions;
    }

    private positionCardInGrid(position: number, elementWidth: number, elementHeight: number, containerWidth: number): string {
        let maxPerRow: number = Math.floor(containerWidth / elementWidth);
        let x: number = (position - (maxPerRow * Math.floor(position / maxPerRow))) * elementWidth;
        let y: number = Math.floor(position / maxPerRow) * elementHeight;

        return 'translate('+ x +', '+ y +')';
    }

    private calculateTotalSVGHeight(dataLength: number, elementWidth: number, elementHeight: number, containerWidth: number): number {
        let totalHeight: number = Math.ceil(dataLength / Math.floor(containerWidth / elementWidth)) * elementHeight;

        return totalHeight;
    }

    private fitTextInMaxWidth(text: string, fontFamily: string, fontSize: string, cardWidth: number): string {
        let textProperties: TextProperties = {
            text: text,
            fontFamily: fontFamily,
            fontSize: fontSize
        };

        return textMeasurementService.getTailoredTextOrDefault(textProperties, cardWidth);
    }


    private static separateTextInLines(text: string, maxLineLength: number): string[] {
        let splittedWords: string[] = text.split(' ')
            .map((word) => word.match(new RegExp('.{1,' + maxLineLength + '}', 'g')))
            .reduce((accWords, word) => accWords.concat(word), []);

        let buildingLine = '';
        let splittedLines = [];
        for (let word in splittedWords) {
            if ((buildingLine + ' ' + splittedWords[word]).length > maxLineLength) {
                splittedLines.push(buildingLine.slice(1));
                buildingLine = '';
            }
            buildingLine += (' ' + splittedWords[word]);
            if (parseInt(word) == splittedWords.length - 1) splittedLines.push(buildingLine.slice(1));
        }

        return splittedLines.filter(l => l.length);
    }


    private fitMultiLineLongText(text: string, fontFamily: string, fontSize: string, elementX: number, elementWidth: number, fontHeight: number): string {
        let textProperties: TextProperties = {
            text: text,
            fontFamily: fontFamily,
            fontSize: fontSize
        };

        let textWidth: number = textMeasurementService.measureSvgTextWidth(textProperties);
        let textLength: number = text.length;
        let maxCharsPerLine: number = Math.floor(textLength * (elementWidth / textWidth)) - 1;
        let splittedText: string[] = Visual.separateTextInLines(text, maxCharsPerLine);

        let multiLineHtmlText: string = '<tspan>' + splittedText[0] + '</tspan>';
        splittedText.slice(1).forEach((line: string) => {
            multiLineHtmlText += '<tspan x = ' + elementX + ', dy=' + fontHeight + '>' + line + '</tspan>'
        });

        return multiLineHtmlText;
    }

    private calculateCardTextHeight(text: string, fontFamily: string, fontSize: string): number {
        let textProperties: TextProperties = {
            text: text,
            fontFamily: fontFamily,
            fontSize: fontSize
        };

        return textMeasurementService.measureSvgTextHeight(textProperties);
    }

    private calculateMultiLineTextHeight(text: string, fontFamily: string, fontSize: string, cardWidth: number, fontHeight: number): number {
        let textProperties: TextProperties = {
            text: text,
            fontFamily: fontFamily,
            fontSize: fontSize
        };
        let textWidth: number = textMeasurementService.measureSvgTextWidth(textProperties);
        let textLength: number = text.length;
        let maxCharsPerLine: number = Math.floor(textLength * (cardWidth / textWidth)) - 1;
        let splittedText: string[] = Visual.separateTextInLines(text, maxCharsPerLine);

        let totalTextHeight: number = splittedText.length * fontHeight;

        return totalTextHeight;
    }

    private calculateInformationHeights(
        information: CardDataPoint, fontFamily: string, fontSize: string, maxWidth: number, fontHeight: number
    ): any[] {
        let heights = information.values.map(
            v => this.calculateMultiLineTextHeight(v.toString(), fontFamily, fontSize, maxWidth, fontHeight)
        );

        return heights;
    }

    private changeOpacityOnHighlight(highlighted: boolean) {
        return (highlighted ? 1 : 0.4);
    }


    // Helper methods for selection, tooltips, etc
    private syncSelectionState(
        selection: Selection<CardDataPoint>, 
        selectionIds: ISelectionId[]
    ): void {
        if(!selection || !selectionIds) return;
        if(!selectionIds.length) {
            const opacity: number = this.changeOpacityOnHighlight(true);
            selection.style('opacity', opacity);

            return;
        }
        const self: this = this;

        selection.each(function(cardDataPoint: CardDataPoint) {
            const isSelected: boolean = self.isSelectionIdInArray(selectionIds, cardDataPoint.selectionId);
            const opacity: number = self.changeOpacityOnHighlight(isSelected)

            d3.select(this).style('opacity', opacity);
        })
    }


    private isSelectionIdInArray(selectionIds: ISelectionId[], selectionId: ISelectionId): boolean {
        if (!selectionIds || !selectionId) {
            return false;
        }

        return selectionIds.some((currentSelectionId: ISelectionId) => {
            return currentSelectionId.includes(selectionId);
        });
    }



    private getTooltipData(value: CardDataPoint): VisualTooltipDataItem[] {
        let fields = value.fields.concat(value.tooltipFields);
        let values = value.values.concat(value.tooltipValues);

        let tooltip = [];
        for(let i = 0; i < values.length; i++) {
            tooltip.push({
                displayName: fields[i],
                value: values[i].toString(),
                header: value.title
            })
        }
        return tooltip;
    }

    private HandleLandingPage(options: VisualUpdateOptions) {
        if(!options.dataViews || !options.dataViews.length) {
            if(!this.isLandingPageOn) {
                this.isLandingPageOn = true;
                this.LandingPageRemoved = false;
                const LandingPage: Element = this.createLandingPage();
                this.element.appendChild(LandingPage);
                this.LandingPage = d3Select(LandingPage);
            }
         } else {
            if(this.isLandingPageOn && !this.LandingPageRemoved) {
                this.isLandingPageOn = false;
                this.LandingPageRemoved = true;
                this.LandingPage.remove();
            }
        }
    }

    private createLandingPage(): Element {
        let div = document.createElement('div');
        div.setAttribute('class', 'LandingPage');

        let GuidelinesHeader = document.createElement('h1');
        GuidelinesHeader.setAttribute('class', 'LandingPageHeader');
        GuidelinesHeader.style.color = getPaletteProperty('foreground', this.host.colorPalette, 'black')
        GuidelinesHeader.textContent = 'Visual guidelines';
        div.appendChild(GuidelinesHeader);

        let guidelines = [
            'Using a field for titles is mandatory',
            'To show up data, you need either a value field or an image',
            'You can add up to 8 measures in Values fields',
            'Multiselect cards using ctrl key',
            'Avoid using boolean measure in values with highlight mode',
            'Activate/deactivate conditional formatting under Cards pane, but set the rules in Conditional Formatting pane',
            'If you want to use cover mode, try to get images with close dimensions for the best results'
        ];

        let list = document.createElement('ul');
        div.appendChild(list);

        guidelines.forEach(r => {
            let item = document.createElement('li');
            item.setAttribute('class', 'LandingPageText');
            item.style.color = getPaletteProperty('foreground', this.host.colorPalette, 'black')
            list.appendChild(item);
            item.textContent = r;
        });

        let SupportHeader = document.createElement('h1');
        SupportHeader.setAttribute('class', 'LandingPageHeader');
        SupportHeader.style.color = getPaletteProperty('foreground', this.host.colorPalette, 'black')
        SupportHeader.textContent = 'Support and Feedback';
        div.appendChild(SupportHeader);

        let supportLink = document.createElement('span');
        let supportText = document.createTextNode('Issues, ideas or want to provide feedback? Access https://fdanielsouza.github.io/');
        supportLink.setAttribute('class', 'LandingPageText');
        supportLink.style.color = getPaletteProperty('foreground', this.host.colorPalette, 'black')
        supportLink.appendChild(supportText);
        div.appendChild(supportLink);

        return div;
    }
}