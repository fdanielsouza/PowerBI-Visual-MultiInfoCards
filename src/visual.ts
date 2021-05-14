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
import { CardsInformationsSettings, CardsSettings, VisualSettings } from "./settings";
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


interface CardSettings {
    cardBackground: {
        width: number,
        fill: string,
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
        mode: string
    };
}

interface CardsDimensions {
    general: {
        width: number,
        height: number,
        padding: number,
        margin: number
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
    }

    header: {
        titles: {
            x: number,
            y: number,
            width: number
        };

        images: {
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
    }
}


function visualTransform(options: VisualUpdateOptions, host: IVisualHost, visualSettings: VisualSettings): CardViewModel {
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
    let cardSettings: CardSettings = {
        cardBackground: {
            width: visualSettings.cards.cardWidth,
            fill: getPaletteProperty('background', palette, visualSettings.cards.backgroundColor),
            transparency: visualSettings.cards.backgroundTransparency,
            border: {
                width: getPaletteProperty('strokeWidth', palette, visualSettings.cards.strokeWidth) + "px",
                color: getPaletteProperty('foreground', palette, visualSettings.cards.borderColor),
                radius: visualSettings.cards.borderRadius
            }
        },   
        cardTitle: {
            fontSize: visualSettings.cardsTitles.titleFontSize + "pt",
            fontFamily: visualSettings.cardsTitles.fontFamily,
            fill: getPaletteProperty('foreground', palette, visualSettings.cardsTitles.fontColor)
        },
        cardInformations: {
            fields: {
                fontSize: visualSettings.cardsInformations.fontSize + "pt",
                fontFamily: visualSettings.cardsInformations.fieldsFontFamily,
                fill: getPaletteProperty('foreground', palette, visualSettings.cardsInformations.fieldsFontColor)
            },
            values: {
                fontSize: visualSettings.cardsInformations.secFontSize + "pt",
                fontFamily: visualSettings.cardsInformations.valuesFontFamily,
                fill: getPaletteProperty('foreground', palette, visualSettings.cardsInformations.valuesFontColor),
                displayUnits: visualSettings.cardsInformations.valuesDisplayUnits
            }
        },
        cardImages: {
            mode: visualSettings.cardsImages.imageMode
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
        const color: string = formatting ? formatting[i].cards.backgroundColor["solid"].color: cardSettings.cardBackground.fill;

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
    private visualSettings: VisualSettings;
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

        this.visualSettings = VisualSettings.parse<VisualSettings>(options.dataViews[0]);
        
        let viewModel: CardViewModel = visualTransform(options, this.host, this.visualSettings);
        this.cardSettings = viewModel.settings;
        this.cardDataPoints = viewModel.dataPoints;

        // Having images will impact positioning of several elements, so this will be used further in logical tests
        let hasImages = this.cardDataPoints.filter(p => p.image != null).length;

        // Static size values
        let cardMargin = 5;
        let cardPadding = 15;

        // Dynamic size values
        let cardWidth = d3.min([d3.max([150, this.cardSettings.cardBackground.width]), 1200]);
        let containerWidth = d3.max([cardWidth, options.viewport.width])
        let backgroundWidth = cardWidth - (2 * cardMargin);
        let contentWidth = cardWidth - (2 * cardPadding);
        let imageWidth = 24 * (0.5 + Math.floor(cardWidth / 100));
        let imageHeight = 24 * (0.5 + Math.floor(cardWidth / 100));
        // Title will be at the top of each card, if there's an image, it will be at it's side, vertically in the middle
        let titleWidth = hasImages ? contentWidth - imageWidth - 20 : contentWidth;
        let titleXPadding = hasImages ? cardPadding + 10 + imageWidth : cardPadding;

 
        // Calculate font heights for each kind of text, so we can set correct spacing between elements
        let titleFontHeight = this.calculateCardTextHeight('Power BI Sample Text', this.cardSettings.cardTitle.fontFamily, this.cardSettings.cardTitle.fontSize);
        let fieldsFontHeight = this.calculateCardTextHeight('Power BI Sample Text', this.cardSettings.cardInformations.fields.fontFamily, this.cardSettings.cardInformations.fields.fontSize);
        let valuesFontHeight = this.calculateCardTextHeight('Power BI Sample Text', this.cardSettings.cardInformations.values.fontFamily, this.cardSettings.cardInformations.values.fontSize);

        // Gets the needed height to display each block of information
        let informationHeights = this.cardDataPoints.map(p => 
            this.calculateInformationHeights(p, this.cardSettings.cardInformations.values.fontFamily, this.cardSettings.cardInformations.values.fontSize, contentWidth, valuesFontHeight)
        );
        let longestHeights = d3.transpose(informationHeights).map(i => i.reduce<number>((a: number, b: number) => a > b ? a : b, 0) + 5);
        let totalLongestHeight = longestHeights.reduce<number>((a: number, b:number) => a + b, 0)

        // Determining the height for individual cards, based on the accumulated spacing nedded for informations plus title and image heights
        let cardHeight = 30 + totalLongestHeight 
            + (fieldsFontHeight * this.cardDataPoints[0].fields.length)
            + (hasImages ? d3.max([titleFontHeight, imageHeight]) : titleFontHeight * 2)
        
        let backgroundHeight = cardHeight - (2 * cardMargin);
        let contentHeight = cardHeight - (2 * cardPadding);
        let titleYPadding = hasImages ? (imageHeight + cardPadding) / 2 + (titleFontHeight / 2) : cardPadding + titleFontHeight;      
        // The start position of information part depends on whether there's an image and if title height it's bigger than it or not
        let infoYPadding = cardPadding + (hasImages ? d3.max([imageHeight, titleFontHeight]) : titleFontHeight * 2);        
        
        const dimensions = this.getCardsDimensions(options.viewport.width, hasImages, this.cardSettings.cardImages.mode, titleFontHeight, fieldsFontHeight, valuesFontHeight);
        console.log(dimensions)

        let container = this.svg
            .attr('height', this.calculateTotalSVGHeight(this.cardDataPoints.length, cardWidth, cardHeight, containerWidth))
            .attr('width', containerWidth);
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
            .attr('transform', (_, i) => this.positionCardInGrid(i, cardWidth, cardHeight, containerWidth));

        cards
            .each(function(d) {
                // Creates a background rect for each card
                d3.select(this)
                    .selectAll('.background')
                    .data([d.color])
                    .enter()
                        .append<SVGElement>('rect')
                        .classed('background', true)
                        .attr('x', cardMargin)
                        .attr('y', cardMargin)
                        .attr('height', backgroundHeight)
                        .attr('width', backgroundWidth)
                        .style('fill', c => c)
                        .style('opacity', (1 - (self.cardSettings.cardBackground.transparency / 100)))
                        .style('stroke', self.cardSettings.cardBackground.border.color)
                        .style('stroke-width', self.cardSettings.cardBackground.border.width)
                        .attr('rx', d3.min([15, self.cardSettings.cardBackground.border.radius]));

                // At the top position of the card, each title
                d3.select(this)
                    .selectAll('.title')
                    .data([d.title])
                    .enter()
                        .append<SVGElement>('text')
                        .classed('title', true)
                        .attr('x', titleXPadding)
                        .attr('y', titleYPadding)
                        .attr('width', titleWidth)
                        .style('font-size', self.cardSettings.cardTitle.fontSize)
                        .style('font-family', self.cardSettings.cardTitle.fontFamily)
                        .style('fill', self.cardSettings.cardTitle.fill)
                        .text((t: string) => {
                            return self.fitTextInMaxWidth(
                                t, 
                                self.cardSettings.cardTitle.fontFamily, 
                                self.cardSettings.cardTitle.fontSize, 
                                titleWidth
                            )
                        });

                // Images if they do exists
                if(hasImages) {
                    d3.select(this)
                        .selectAll('.image')
                        .data([d.image])
                        .enter()
                            .append<SVGElement>('svg:image')
                            .classed('image', true)
                            .attr('x', cardPadding)
                            .attr('y', cardPadding)
                            .attr('height', imageHeight)
                            .attr('width', imageWidth)
                            .attr('xlink:href', (i: string) => i);
                }

                // First we position each field name
                d3.select(this)
                    .selectAll('.information-fields')
                    .data(d.fields)
                    .enter()
                        .append<SVGElement>('text')
                        .classed('information-fields', true)
                        .attr('x', cardPadding)
                        .attr('y', (_, i) => infoYPadding + ((i + 1) * fieldsFontHeight) + longestHeights.slice(0, i).reduce<number>((a: number, b: number) => a + b, 0))
                        .attr('height', contentHeight)
                        .attr('width', contentWidth)
                        .style('font-size', self.cardSettings.cardInformations.fields.fontSize)
                        .style('font-family', self.cardSettings.cardInformations.fields.fontFamily)
                        .style('fill', self.cardSettings.cardInformations.fields.fill)
                        .text((field: string) => 
                            self.fitTextInMaxWidth(
                                field, 
                                self.cardSettings.cardInformations.fields.fontFamily, 
                                self.cardSettings.cardInformations.fields.fontSize, 
                                contentWidth
                            )
                        );


                // Then each of its values
                d3.select(this)
                    .selectAll('.information-values')
                    .data(d.values)
                    .enter()
                        .append<SVGElement>('text')
                        .classed('information-values', true)
                        .attr('x', cardPadding)
                        .attr('y', (_, i) => infoYPadding + valuesFontHeight + ((i + 1) * fieldsFontHeight) + longestHeights.slice(0, i).reduce<number>((a: number, b: number) => a + b, 0))
                        .attr('height', contentHeight)
                        .attr('width', contentWidth)
                        .style('font-size', self.cardSettings.cardInformations.values.fontSize)
                        .style('font-family', self.cardSettings.cardInformations.values.fontFamily)
                        .style('fill', self.cardSettings.cardInformations.values.fill)
                        .html((value: any) => {
                            return self.fitMultiLineLongText(
                                value, 
                                self.cardSettings.cardInformations.values.fontFamily,
                                self.cardSettings.cardInformations.values.fontSize,
                                cardPadding, 
                                contentWidth, 
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
        const settings: VisualSettings = this.visualSettings || <VisualSettings>VisualSettings.getDefault();
        let objectEnum = VisualSettings.enumerateObjectInstances(settings, options);

        switch(objectEnum["instances"][0].objectName) {
            case 'cards':
                objectEnum["instances"][0].properties.backgroundColor = { solid: { color: objectEnum["instances"][0].properties.backgroundColor } }; 
                objectEnum["instances"][0].propertyInstanceKind = { backgroundColor: VisualEnumerationInstanceKinds.ConstantOrRule };
                objectEnum["instances"][0].selector = dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals);
                objectEnum["instances"][0].altConstantValueSelector = this.cardDataPoints.map(p => p.selectionId.getSelector());
                break;
        }

        return objectEnum;
    }


    // My own methods to deal with sizing stuff
    private getCardsDimensions(viewportWidth: number, hasImages: number, imageMode: string, titlesHeight: number, fieldsHeight: number, valuesHeight: number): CardsDimensions {
        let dimensions: CardsDimensions = {
            general: {
                width: 0,
                height: 0,
                padding: 15,
                margin: 5
            },
            content: {
                background: {
                    width: 0,
                    height: 0
                },        
                inner:{
                    width: 0,
                    height: 0
                },
            },        
            header: {
                titles: {
                    x: 0,
                    y: 0,
                    width: 0
                },
                images: {
                    width: 0,
                    height: 0
                }
            },        
            body: {
                informations: {
                    heights: [],
                    totalHeight: 0,
                    y: 0
                }
            }
        };

        if(!viewportWidth
        || !this.cardDataPoints
        || !this.cardSettings
        ) return dimensions;
            

        dimensions.general.width = d3.min([d3.max([150, this.cardSettings.cardBackground.width]), 1200]);
        dimensions.content.background.width = dimensions.general.width - (2 * dimensions.general.margin);
        dimensions.content.inner.width = dimensions.general.width - (2 * dimensions.general.padding);
        dimensions.header.images.width = 24 * (0.5 + Math.floor(dimensions.general.width / 100));
        dimensions.header.images.height = 24 * (0.5 + Math.floor(dimensions.general.width / 100));
        
        // Title will be at the top of each card, if there's an image, it will be at it's side, vertically in the middle
        dimensions.header.titles.width = hasImages ? dimensions.content.inner.width - dimensions.header.images.width - 20 : dimensions.content.inner.width;
        dimensions.header.titles.x = hasImages ? dimensions.general.padding + 10 + dimensions.header.images.width : dimensions.general.padding;

        // Gets the needed height to display each block of information
        const informationHeights = this.cardDataPoints.map(p => 
            this.calculateInformationHeights(p, this.cardSettings.cardInformations.values.fontFamily, this.cardSettings.cardInformations.values.fontSize, dimensions.content.inner.width, valuesHeight)
        );
        dimensions.body.informations.heights = d3.transpose(informationHeights).map(i => i.reduce<number>((a: number, b: number) => a > b ? a : b, 0) + 5);
        dimensions.body.informations.totalHeight = dimensions.body.informations.heights.reduce<number>((a: number, b:number) => a + b, 0)

        // Determining the height for individual cards, based on the accumulated spacing nedded for informations plus title and image heights
        dimensions.general.height = 30 + dimensions.body.informations.totalHeight
            + (fieldsHeight * this.cardDataPoints[0].fields.length)
            + (hasImages ? d3.max([titlesHeight, dimensions.header.images.height]) : titlesHeight * 2);
        
        dimensions.content.background.height = dimensions.general.height - (2 * dimensions.general.margin);
        dimensions.content.inner.height = dimensions.general.height - (2 * dimensions.general.margin);
        dimensions.header.titles.y = hasImages ? (dimensions.header.images.height + dimensions.general.padding) / 2 + (titlesHeight / 2) : dimensions.general.padding + titlesHeight; 

        // The start position of information part depends on whether there's an image and if title height it's bigger than it or not
        dimensions.body.informations.y = dimensions.general.padding + (hasImages ? d3.max([dimensions.header.images.height, titlesHeight]) : titlesHeight * 2);        
        
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
            'Avoid using boolean measure in values with highlight mode'
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

