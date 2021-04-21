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
import { VisualSettings } from "./settings";
import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.IVisualHost;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import * as d3 from "d3";
import { dataViewObject } from "powerbi-visuals-utils-dataviewutils";
import { line, range, style } from "d3";

type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;


export class Visual implements IVisual {
    private visualSettings: VisualSettings;
    private host: IVisualHost;
    private svg: Selection<SVGElement>;

    constructor(options: VisualConstructorOptions) {
        options.element.style.overflowY = 'auto';
        
        this.svg = d3.select(options.element)
            .append('svg')
            .classed('multiInfoCards', true);
    }


    public update(options: VisualUpdateOptions) {
        // Remove all cards, titles and images
        this.svg.selectAll('.background').remove()
        this.svg.selectAll('.title').remove()
        this.svg.selectAll('.image').remove()
        // Remove all possible infos at once
        range(9).forEach((index) => this.svg.selectAll('.info' + index).remove());

        let dataView: DataView = options.dataViews[0];
        if(!dataView.categorical.hasOwnProperty('values')) return;

        let titleValues = dataView.categorical.categories[0].values;
        let infoValues = dataView.categorical.values.filter((infoValue => infoValue.source.roles.informations == true));
        let infoImages = dataView.categorical.values.filter((infoValue => infoValue.source.roles.images == true))[0];

        this.visualSettings = VisualSettings.parse<VisualSettings>(dataView);
        
        // Fonts and text properties
        let titlesFontSize = this.visualSettings.cardsTitles.titleFontSize + "pt";
        let titlesFontHeight = Visual.calculateCardTextHeight('Power BI Sample Text', this.visualSettings.cardsTitles.fontFamily, titlesFontSize);
        let infoNamesFontSize = this.visualSettings.cardsInformations.infoNamesFontSize + "pt";
        let infoNamesFontHeight = Visual.calculateCardTextHeight('Power BI Sample Text', this.visualSettings.cardsInformations.infoNamesFontFamily, infoNamesFontSize);
        let infoValuesFontSize = this.visualSettings.cardsInformations.infoValuesFontSize + "pt";
        let infoValuesFontHeight = Visual.calculateCardTextHeight('Power BI Sample Text', this.visualSettings.cardsInformations.infoValuesFontFamily, infoValuesFontSize);
        let infoValuesDisplayUnits = this.visualSettings.cardsInformations.infoValuesDisplayUnits;

        // Cards and texts attributes and properties
        let containerHeight = options.viewport.height;
        let containerWidth = options.viewport.width;

        let cardHeight = d3.min([d3.max([150, this.visualSettings.cards.cardHeight]), 1200]);
        let cardWidth = d3.min([d3.max([150, this.visualSettings.cards.cardWidth]), 1200]);
        let cardX = cardWidth;
        let cardY = cardHeight;
        if(containerWidth < cardWidth) return;
        
        let backgroundX = 5;
        let backgroundY = 5;    
        let backgroundHeight = cardHeight - 10;
        let backgroundWidth = cardWidth - 10;

        let contentX = backgroundX + 10;
        let contentY = backgroundY + 10;
        let contentHeight = backgroundHeight - 20;
        let contentWidth = backgroundWidth - 20;
        
        let imageX = contentX;
        let imageY = contentY;
        let imageHeight = 24 * (0.5 + Math.floor(cardWidth / 150));
        let imageWidth = 24 * (0.5 + Math.floor(cardWidth / 150));

        let titleX = contentX;
        let titleY = contentY + titlesFontHeight;
        let titleHeight = contentHeight;
        let titleWidth = contentWidth;

        let infoX = contentX;
        let infoY = contentY + infoNamesFontHeight + titlesFontHeight * 2;
        let infoHeight = contentHeight;
        let infoWidth = contentWidth;
      
        // if there's an image, position the title on the right of it, and the first info below to not overlap
        if (infoImages !== undefined) {
            titleX = titleX + (20 + imageWidth);
            titleY = (imageHeight + imageY) / 2 + (titlesFontHeight / 2);
            titleWidth = titleWidth - (20 + imageWidth);

            infoY = contentY + infoNamesFontHeight + d3.max([imageHeight, titlesFontHeight]);
            infoHeight -= d3.max([imageHeight, titlesFontHeight]);
        }
    
        let cards = this.svg
            .attr('height', Visual.calculateTotalSVGHeight(titleValues.length, cardX, cardY, containerWidth))
            .attr('width', containerWidth)
            .style('overflow', 'scroll');


        let backgrounds = cards
            .selectAll('.background')
            .data(titleValues)
            .enter()
            
        backgrounds
            .append<SVGElement>('rect')
            .classed('background', true)
            .attr('x', backgroundX)
            .attr('y', backgroundY)
            .attr('height', backgroundHeight)
            .attr('width', backgroundWidth)
            .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardX, cardY, containerWidth))
            .style('fill', this.visualSettings.cards.backgroundColor)
            .style('opacity', 1 - (this.visualSettings.cards.backgroundTransparency / 100))
            .style('stroke', this.visualSettings.cards.borderColor)
            .style('stroke-width', this.visualSettings.cards.borderWidth)
            .attr('rx', d3.min(["15", this.visualSettings.cards.borderRadius]));


        // Render images in top left if there's imageUrl column
        if (infoImages !== undefined) {
            let images = this.svg
                .selectAll('.image')
                .data(infoImages.values)
                .enter();

            images
                .append<SVGElement>('svg:image')
                .classed('image', true)
                .attr('x', imageX)
                .attr('y', imageY)
                .attr('height', imageHeight)
                .attr('width', imageWidth)
                .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardX, cardY, containerWidth))
                .attr('xlink:href', (image: string) => image);

            images
                .exit()
                .remove();
        } else {
            this.svg.selectAll('.image').remove();
        }


        let titles = this.svg
            .selectAll('.title')
            .data(titleValues)
            .enter()

        titles
            .append<SVGElement>('text')
            .classed('title', true)
            .attr('x', titleX)
            .attr('y', titleY)
            .attr('height', titleHeight)
            .attr('width', titleWidth)
            .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardX, cardY, containerWidth))
            .style('font-size', titlesFontSize)
            .style('font-family', this.visualSettings.cardsTitles.fontFamily)
            .style('fill', this.visualSettings.cardsTitles.fontColor)
            .text((title: string) => {
                return Visual.fitTextInMaxWidth(
                    title, 
                    this.visualSettings.cardsTitles.fontFamily, 
                    titlesFontSize, 
                    titleWidth
                )
            });

        // Each field of information values will be rendered over the cards if is there any
        if(infoValues.length){
            infoValues.forEach((infoValue: powerbi.DataViewValueColumn, index: number) => {
                // Uses the method to format dataViewValueColumn.values accordingly, so it can be both measure and displayed
                infoValue.values = Visual.formatColumnValues(infoValue, infoValuesDisplayUnits);
                /**
                 *  Calculate height for each block of information texts, so it can control the minimum  
                 *  spacing between blocks, also recording the totals in the DataViewValueColumn object 
                 *  will let info to not be rendered below card height
                 * 
                 **/ 
                let infoLongestValue = infoValue.values.reduce((c: string, n: string) => c.length > n.length ? c : n);
                let infoLongestHeight = Visual.calculateMultiLineTextHeight(
                    infoLongestValue.toString(), 
                    this.visualSettings.cardsInformations.infoValuesFontFamily, 
                    infoValuesFontSize, 
                    infoWidth,
                    infoValuesFontHeight
                );
                
                infoValue["infoTotalSpacing"] = d3.min([d3.max([infoNamesFontHeight + infoLongestHeight, this.visualSettings.cardsInformations.spaceBetweenInformations]), 600]);            
                infoValue["cumulativeTotalSpacing"] = infoValues.slice(0, index + 1)
                    .map((i: powerbi.DataViewValueColumn) => i["infoTotalSpacing"])
                    .reduce((c: number, n: number) => c + n);

                if (infoValue["cumulativeTotalSpacing"] < infoHeight) {
                    let infos = this.svg
                        .selectAll('.info' + index)
                        .data(infoValue.values)
                        .enter()
                    
                    infos
                        .append<SVGElement>('text')
                        .classed('info' + index, true)
                        .attr('x', infoX)
                        .attr('y', infoY + infoValue["cumulativeTotalSpacing"] - infoValue["infoTotalSpacing"])
                        .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardX, cardY, containerWidth))
                        .style('font-size', infoNamesFontSize)
                        .style('font-family', this.visualSettings.cardsInformations.infoNamesFontFamily)
                        .style('fill', this.visualSettings.cardsInformations.infoNamesFontColor)
                        .text(
                            Visual.fitTextInMaxWidth(
                                infoValue.source.displayName, 
                                this.visualSettings.cardsInformations.infoNamesFontFamily, 
                                infoNamesFontSize, 
                                infoWidth
                            )
                        );

                    infos
                        .append<SVGElement>('text')
                        .classed('info' + index, true)
                        .attr('x', infoX)
                        .attr('y', infoY + infoNamesFontHeight + infoValue["cumulativeTotalSpacing"] - infoValue["infoTotalSpacing"])
                        .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardX, cardY, containerWidth))
                        .style('font-size', infoValuesFontSize)
                        .style('font-family', this.visualSettings.cardsInformations.infoValuesFontFamily)
                        .style('fill', this.visualSettings.cardsInformations.infoValuesFontColor)
                        .html((value: any) => {
                            return Visual.fitMultiLineLongText(
                                value.toString(), 
                                this.visualSettings.cardsInformations.infoValuesFontFamily, 
                                infoValuesFontSize,
                                infoX,
                                infoWidth,
                                infoValuesFontHeight
                            )
                        });

                        infos
                            .exit()
                            .remove(); 
                    }                  
            });
        }

        cards
            .exit()
            .remove();

        backgrounds
            .exit()
            .remove();

        titles
            .exit()
            .remove();
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        const settings: VisualSettings = this.visualSettings || <VisualSettings>VisualSettings.getDefault();
        return VisualSettings.enumerateObjectInstances(settings, options);
    }



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

    public static formatColumnValues(dataViewColumn: powerbi.DataViewValueColumn, displayUnits: string): any[] {
        let result = [];
        if (dataViewColumn.source.format !== undefined && dataViewColumn.source.type.dateTime != true) {
            let iValueFormatter = valueFormatter.create({ format: dataViewColumn.source.format });
            result = dataViewColumn.values.map(v => iValueFormatter.format(v));
        } else if (dataViewColumn.source.format !== undefined && dataViewColumn.source.type.dateTime == true) {
            let iValueFormatter = valueFormatter.create({ format: dataViewColumn.source.format });
            result = dataViewColumn.values.map(v => iValueFormatter.format(d3.isoParse(v.toString())));
        } else if (dataViewColumn.source.type.numeric == true) {
            let iValueFormatter = valueFormatter.create({ value: displayUnits });
            result = dataViewColumn.values.map(v => iValueFormatter.format(v));
        } else {
            result = dataViewColumn.values;
        }

        return result;
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
}

