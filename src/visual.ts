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

import { textMeasurementService, valueFormatter, interfaces } from "powerbi-visuals-utils-formattingutils";
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
import PrimitiveValue = powerbi.PrimitiveValue;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import * as d3 from "d3";
import { dataViewObject } from "powerbi-visuals-utils-dataviewutils";
import {createTooltipServiceWrapper, ITooltipServiceWrapper, TooltipServiceWrapper, touchStartEventName} from "powerbi-visuals-utils-tooltiputils";
import { getLocalizedString } from "./localization/localizationHelper"


type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;


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
 * @property { PrimitiveValue } title                       - Title for the card data point
 * @property { string[] } fields                            - Names of fields inside the card
 * @property { PrimitiveValue[] } values                    - Values of fields in the card
 * @property { PrimitiveValue} image                        - An optional image in the card
 * @property { TooltipItemFields } tooltips                 - Field to store aditional tooltip items
 * @property { ISelectionId } selectionId                   - Id assigned for visual interaction
 */
interface CardDataPoint {
    title: PrimitiveValue;
    fields: string[];
    values: PrimitiveValue[];
    image?: PrimitiveValue;
    tooltipFields?: string[];
    tooltipValues?: PrimitiveValue[];
    selectionId: ISelectionId;
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
        || !dataView.categorical.categories
        || !dataView.categorical.categories[0].source
        || !dataView.categorical.values
    ) {
        return viewModel;
    }

    let titles = dataView.categorical.categories[0].values;
    let informations = dataView.categorical.values.filter(value => value.source.roles.informations == true);
    let images = dataView.categorical.values.filter(value => value.source.roles.images == true)[0] || null;
    let tooltips = dataView.categorical.values.filter(value => value.source.roles.tooltips == true);

    let cardDataPoints: CardDataPoint[] = [];

    let cardSettings: CardSettings = {
        cardBackground: {
            width: visualSettings.cards.cardWidth,
            fill: visualSettings.cards.backgroundColor,
            transparency: visualSettings.cards.backgroundTransparency,
            border: {
                width: visualSettings.cards.strokeWidth + "px",
                color: visualSettings.cards.borderColor,
                radius: visualSettings.cards.borderRadius
            }
        },   
        cardTitle: {
            fontSize: visualSettings.cardsTitles.titleFontSize + "px",
            fontFamily: visualSettings.cardsTitles.fontFamily,
            fill: visualSettings.cardsTitles.fontColor
        },
        cardInformations: {
            fields: {
                fontSize: visualSettings.cardsInformations.fontSize + "px",
                fontFamily: visualSettings.cardsInformations.fieldsFontFamily,
                fill: visualSettings.cardsInformations.fieldsFontColor
            },
            values: {
                fontSize: visualSettings.cardsInformations.secFontSize + "px",
                fontFamily: visualSettings.cardsInformations.valuesFontFamily,
                fill: visualSettings.cardsInformations.valuesFontColor,
                displayUnits: visualSettings.cardsInformations.valuesDisplayUnits
            }
        }   
    }
    
    for (let i = 0; i < titles.length; i++) {
        const selectionId: ISelectionId = host.createSelectionIdBuilder()
            .withCategory(dataView.categorical.categories[0], i)
            .createSelectionId();

        cardDataPoints.push({
            title: titles[i],
            fields: informations.map(info => info.source.displayName),
            values: informations.map(info => formatDataViewValues(info.values[i], getColumnDataType(info.source.type), info.source.format, cardSettings.cardInformations.values.displayUnits)),
            image: images ? images.values[i] : null,
            tooltipFields: tooltips ? tooltips.map(tip => tip.source.displayName) : null,
            tooltipValues: tooltips ? tooltips.map(tip => formatDataViewValues(tip.values[i], getColumnDataType(tip.source.type), tip.source.format, cardSettings.cardInformations.values.displayUnits)) : null, 
            selectionId: selectionId
        });
    }

    return {
        dataPoints: cardDataPoints,
        settings: cardSettings
    }
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
    if (format != null && type != 'dateTime') {
        let iValueFormatter = valueFormatter.create({ format: format });
        return iValueFormatter.format(value);
    } else if (format != null && type == 'dateTime') {
        let iValueFormatter = valueFormatter.create({ format: format });
        return iValueFormatter.format(d3.isoParse(value));
    } else if (type == 'numeric') {
        let iValueFormatter = valueFormatter.create({ value: displayUnits });
        return iValueFormatter.format(value);
    } else {
        return value;
    }
}


export class Visual implements IVisual {
    private visualSettings: VisualSettings;
    private host: IVisualHost;
    private locale: string;
    private selectionManager: ISelectionManager;
    private element: HTMLElement;
    private svg: Selection<SVGElement>;
    private cardDataPoints: CardDataPoint[];
    private cardSettings: CardSettings;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private cardSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>


    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.element = options.element;
        this.locale = options.host.locale;
        this.selectionManager = options.host.createSelectionManager();
        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

        this.svg = d3.select(options.element)
            .append('svg')
            .classed('multiInfoCards', true);
    };


    public update(options: VisualUpdateOptions) { 
        d3.selectAll('.card').remove();
        d3.selectAll('.background').remove();
        d3.selectAll('.image').remove();
        d3.selectAll('.title').remove();
        d3.selectAll('.information-fields').remove();
        d3.selectAll('.information-values').remove();

        this.visualSettings = VisualSettings.parse<VisualSettings>(options.dataViews[0]);
        
        let viewModel: CardViewModel = visualTransform(options, this.host, this.visualSettings);
        let settings = viewModel.settings;
        this.cardDataPoints = viewModel.dataPoints;

        // Having images should impact positioning of several elements, so this will be used further in logical tests
        let hasImages = this.cardDataPoints.filter(p => p.image != null).length;

        let containerWidth = options.viewport.width;
        // Card width can be customized in between 150 and 1200
        let cardWidth = d3.min([d3.max([150, settings.cardBackground.width]), 1200]);
        let cardMargin = 5;
        let cardPadding = 15;
        let backgroundWidth = cardWidth - (2 * cardMargin);
        let contentWidth = cardWidth - (2 * cardPadding);
        let imageWidth = 24 * (0.5 + Math.floor(cardWidth / 150));
        let imageHeight = 24 * (0.5 + Math.floor(cardWidth / 150));
        // Title will be at the top of each card, if there's an image, it will be at it's side, vertically in the middle
        let titleWidth = hasImages ? contentWidth - imageWidth - 20 : contentWidth;
        let titleXPadding = hasImages ? cardPadding + 20 + imageWidth : cardPadding;

        // If the entire container is thinner than a single card, just return... or a lot of NaN and Inf should raise in position calcs
        if(containerWidth < cardWidth) return;
 
        // Calculate font heights for each kind of text, so spacing between elements can be calculated
        let titleFontHeight = Visual.calculateCardTextHeight('Power BI Sample Text', settings.cardTitle.fontFamily, settings.cardTitle.fontSize);
        let fieldsFontHeight = Visual.calculateCardTextHeight('Power BI Sample Text', settings.cardInformations.fields.fontFamily, settings.cardInformations.fields.fontSize);
        let valuesFontHeight = Visual.calculateCardTextHeight('Power BI Sample Text', settings.cardInformations.values.fontFamily, settings.cardInformations.values.fontSize);

        // Now calculate the needed number of lines for each information, so we can have the card each value height the longest one
        let informationHeights = this.cardDataPoints.map(p => p.values
            .map(v => Visual.calculateMultiLineTextHeight(
                v.toString(), 
                settings.cardInformations.values.fontFamily, 
                settings.cardInformations.values.fontSize, 
                contentWidth, 
                valuesFontHeight
            )
        ));
        let longestHeights = d3.transpose(informationHeights).map(i => i.reduce((a: number, b: number) => a > b ? a + 2 : b + 2));
        let totalLongestHeight = longestHeights.reduce<number>((a: number, b:number) => a + b, 0)
        
        // Determining the height for individual cards, based on the accumulated spacing nedded for informations plus title and image heights
        let cardHeight = 30 + totalLongestHeight 
            + (fieldsFontHeight * this.cardDataPoints[0].fields.length)
            + (hasImages ? d3.max([titleFontHeight, 24 * (0.5 + Math.floor(cardWidth / 150))]) : titleFontHeight * 2)
        
        let backgroundHeight = cardHeight - (2 * cardMargin);
        let contentHeight = cardHeight - (2 * cardPadding);
        let titleYPadding = hasImages ? (imageHeight + cardPadding) / 2 + (titleFontHeight / 2) : cardPadding + titleFontHeight;      
        // The start position of information part depends on whether there's an image and if title height it's bigger than it or not
        let infoYPadding = cardPadding + (hasImages ? d3.max([imageHeight, titleFontHeight]) : titleFontHeight * 2);        
        
        
        
        
        let container = this.svg
            .attr('height', Visual.calculateTotalSVGHeight(this.cardDataPoints.length, cardWidth, cardHeight, containerWidth))
            .attr('width', containerWidth);
        /*
                Now we'll render each card on the screen and all of it's inner elements
        */
        let cards = container
            .selectAll('.card')
            .data(this.cardDataPoints)
            .enter()
                .append('g')
                .classed('card', true)
                .attr('transform', (_, i) => Visual.positionCardInGrid(i, cardWidth, cardHeight, containerWidth));

        cards
            .each(function(d) {

                // Creates a background rect for each card
                d3.select(this)
                    .selectAll('.background')
                    .data([d])
                    .enter()
                        .append<SVGElement>('rect')
                        .classed('background', true)
                        .attr('x', cardMargin)
                        .attr('y', cardMargin)
                        .attr('height', backgroundHeight)
                        .attr('width', backgroundWidth)
                        .style('fill', settings.cardBackground.fill)
                        .style('opacity', 1 - (settings.cardBackground.transparency / 100))
                        .style('stroke', settings.cardBackground.border.color)
                        .style('stroke-width', settings.cardBackground.border.width)
                        .attr('rx', d3.min([15, settings.cardBackground.border.radius]));

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
                        .style('font-size', settings.cardTitle.fontSize)
                        .style('font-family', settings.cardTitle.fontFamily)
                        .style('fill', settings.cardTitle.fill)
                        .text((t: string) => {
                            return Visual.fitTextInMaxWidth(
                                t, 
                                settings.cardTitle.fontFamily, 
                                settings.cardTitle.fontSize, 
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
                        .style('font-size', settings.cardInformations.fields.fontSize)
                        .style('font-family', settings.cardInformations.fields.fontFamily)
                        .style('fill', settings.cardInformations.fields.fill)
                        .text(d => 
                            Visual.fitTextInMaxWidth(
                                d, 
                                settings.cardInformations.fields.fontFamily, 
                                settings.cardInformations.fields.fontSize, 
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
                        .style('font-size', settings.cardInformations.values.fontSize)
                        .style('font-family', settings.cardInformations.values.fontFamily)
                        .style('fill', settings.cardInformations.values.fill)
                        .html((d: any) => {
                            return Visual.fitMultiLineLongText(
                                d, 
                                settings.cardInformations.values.fontFamily,
                                settings.cardInformations.values.fontSize,
                                cardPadding, 
                                contentWidth, 
                                valuesFontHeight
                            )
                        });
            });


            // Add listeners for tooltips and selection
            this.svg.selectAll('.card')
                .on('click', d => this.selectionManager.select(d.selectionId));

            this.tooltipServiceWrapper.addTooltip(
                this.svg.selectAll('.card'),
                (datapoint: CardDataPoint) => this.getTooltipData(datapoint),
                (datapoint: CardDataPoint) => datapoint.selectionId,
                false
            );


            cards
                .exit()
                .remove();
    } 

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        const settings: VisualSettings = this.visualSettings || <VisualSettings>VisualSettings.getDefault();
        return VisualSettings.enumerateObjectInstances(settings, options);
    }



    // My own methods to deal with sizing stuff
    public static positionCardInGrid(position: number, elementWidth: number, elementHeight: number, containerWidth: number): string {
        let maxPerRow: number = Math.floor(containerWidth / elementWidth);
        let x: number = (position - (maxPerRow * Math.floor(position / maxPerRow))) * elementWidth;
        let y: number = Math.floor(position / maxPerRow) * elementHeight;

        return 'translate('+ x +', '+ y +')';
    }

    public static calculateTotalSVGHeight(dataLength: number, elementWidth: number, elementHeight: number, containerWidth: number): number {
        let totalHeight: number = Math.ceil(dataLength / Math.floor(containerWidth / elementWidth)) * elementHeight;

        return totalHeight;
    }

    public static fitTextInMaxWidth(text: string, fontFamily: string, fontSize: string, cardWidth: number): string {
        let textProperties: TextProperties = {
            text: text,
            fontFamily: fontFamily,
            fontSize: fontSize
        };

        return textMeasurementService.getTailoredTextOrDefault(textProperties, cardWidth);
    }


    public static separateTextInLines(text: string, maxLineLength: number): string[] {
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


    public static fitMultiLineLongText(text: string, fontFamily: string, fontSize: string, elementX: number, elementWidth: number, fontHeight: number): string {
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

    public static calculateCardTextHeight(text: string, fontFamily: string, fontSize: string): number {
        let textProperties: TextProperties = {
            text: text,
            fontFamily: fontFamily,
            fontSize: fontSize
        };

        return textMeasurementService.measureSvgTextHeight(textProperties);
    }

    public static calculateMultiLineTextHeight(text: string, fontFamily: string, fontSize: string, cardWidth: number, fontHeight: number): number {
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


    // Helper methods for selection, tooltips, etc
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
}

