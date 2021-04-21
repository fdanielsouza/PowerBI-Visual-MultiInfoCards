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

import { textMeasurementService, interfaces } from "powerbi-visuals-utils-formattingutils";
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
import { line, style } from "d3";

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
        let dataView: DataView = options.dataViews[0];
        if(!dataView.categorical.hasOwnProperty('values')) return;

        let titleValues = dataView.categorical.categories[0].values;
        let infoValues = dataView.categorical.values.filter((infoValue => infoValue.source.roles.informations == true));
        let infoImages = dataView.categorical.values.filter((infoValue => infoValue.source.roles.images == true))[0];

        this.visualSettings = VisualSettings.parse<VisualSettings>(dataView);
        
        //infoImages = infoImages[0]
        // Fonts and text properties
        let titlesFontSize = this.visualSettings.cardsTitles.fontSize + "pt";
        let titlesFontHeight = Visual.calculateCardTextHeight('Power BI Sample Text', this.visualSettings.cardsTitles.fontFamily, titlesFontSize);
        let infoNamesFontSize = this.visualSettings.cardsInformations.infoNamesFontSize + "pt";
        let infoNamesFontHeight = Visual.calculateCardTextHeight('Power BI Sample Text', this.visualSettings.cardsInformations.infoNamesFontFamily, infoNamesFontSize);
        let infoValuesFontSize = this.visualSettings.cardsInformations.infoValuesFontSize + "pt";
        let infoValuesFontHeight = Visual.calculateCardTextHeight('Power BI Sample Text', this.visualSettings.cardsInformations.infoValuesFontFamily, infoValuesFontSize);
        
        // Cards and texts attributes and properties
        let containerHeight = options.viewport.height;
        let containerWidth = options.viewport.width;
        let cardHeight = d3.min([d3.max([150, this.visualSettings.cards.cardHeight]), 1200]);
        let cardWidth = d3.min([d3.max([150, this.visualSettings.cards.cardWidth]), 1200]);
        let cardX = cardWidth;
        let cardY = cardHeight;
        
        let backgroundX = 5;
        let backgroundY = 5;    
        let backgroundHeight = cardHeight - 10;
        let backgroundWidth = cardWidth - 10;

        let contentX = backgroundX + 5;
        let contentY = backgroundY + 5;
        let contentHeight = backgroundHeight - 10;
        let contentWidth = backgroundWidth - 10;
        
        let imageX = contentX;
        let imageY = contentY;
        let imageHeight = 24 * (0.5 + Math.floor(cardWidth / 150));
        let imageWidth = 24 * (0.5 + Math.floor(cardWidth / 150));

        let titleX = contentX;
        let titleY = contentY;
        let titleHeight = contentHeight;
        let titleWidth = contentWidth;

        let infoX = contentX;
        let infoY = contentY + infoNamesFontHeight + titlesFontHeight * 2;
        let infoHeight = contentHeight;
        let infoWidth = contentWidth;
        // if there's an image, recalculate title to stand after it, and the first info to not overlap the image
        if (infoImages !== undefined) {
            titleX += imageWidth;
            titleY = imageHeight / 2 - titlesFontHeight / 2;
            titleWidth -= imageWidth;

            infoY = contentY + infoNamesFontHeight + imageHeight;
            infoHeight -= imageHeight;
        }
    
        let cards = this.svg
            .attr('height', Visual.calculateTotalSVGHeight(titleValues.length, cardX, cardY, containerWidth))
            .attr('width', containerWidth)
            .style('overflow', 'scroll');


        let backgrounds = cards
            .selectAll('.background')
            .data(titleValues)
            
        let mergeElement = backgrounds.enter().append<SVGElement>('rect').classed('background', true);
        backgrounds
            .merge(mergeElement)
            .attr('x', backgroundX)
            .attr('y', backgroundY)
            .attr('height', backgroundHeight)
            .attr('width', backgroundWidth)
            .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardX, cardY, containerWidth))
            .style('fill', this.visualSettings.cards.backgroundColor);


        // Render images in top left if there's imageUrl column
        if (infoImages !== undefined) {
            let images = this.svg
                .selectAll('.image')
                .data(infoImages.values);

            mergeElement = images.enter().append<SVGElement>('svg:image').classed('image', true);
            images
                .merge(mergeElement)
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

        mergeElement = titles.enter().append<SVGElement>('text').classed('title', true);
        titles
            .merge(mergeElement)
            .attr('x', titleX)
            .attr('y', titleY + titlesFontHeight)
            .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardX, cardY, containerWidth))
            .style('font-size', titlesFontSize)
            .style('font-family', this.visualSettings.cardsTitles.fontFamily)
            .style('fill', this.visualSettings.cardsTitles.fontColor)
            .text((title: string) => {
                return Visual.fitTextInsideCard(
                    title, 
                    this.visualSettings.cardsTitles.fontFamily, 
                    titlesFontSize, 
                    titleWidth
                )
            });


        // Each field of information values will be rendered over the cards
        infoValues.forEach((infoValue: powerbi.DataViewValueColumn, index: number) => {
            this.svg.selectAll('.info' + index).remove();
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
                    .append('text')
                    .classed('info' + index, true)
                    .attr('x', infoX)
                    .attr('y', infoY + infoValue["cumulativeTotalSpacing"] - infoValue["infoTotalSpacing"])
                    .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardX, cardY, containerWidth))
                    .style('font-size', infoNamesFontSize)
                    .style('font-family', this.visualSettings.cardsInformations.infoNamesFontFamily)
                    .style('fill', this.visualSettings.cardsInformations.infoNamesFontColor)
                    .text(
                        Visual.fitTextInsideCard(
                            infoValue.source.displayName, 
                            this.visualSettings.cardsInformations.infoNamesFontFamily, 
                            infoNamesFontSize, 
                            infoWidth
                        )
                    );

                infos
                    .append('text')
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
        console.log(totalHeight)
        return totalHeight;
    }

    public static fitTextInsideCard(text: string, fontFamily: string, fontSize: string, cardWidth: number): string {
        let textProperties: TextProperties = {
            text: text,
            fontFamily: fontFamily,
            fontSize: fontSize
        };

        return textMeasurementService.getTailoredTextOrDefault(textProperties, cardWidth);
    }

    public static separateTextInLines(text: string, maxLineLength: number): string[] {
        let splittedWords: string[] = text.split(' ');
        let wordLengths = splittedWords.map((word: string) => word.length);

        let endOfLines: number[] = [0];
        wordLengths.reduce((previousLength: number, currentLength: number, index: number) => {
            if (previousLength + currentLength + index > maxLineLength) {
                endOfLines.push(index);
                return currentLength;
            }
            return previousLength + currentLength
        });
        endOfLines.push(wordLengths.length);

        let splittedLines: string[] = [];
        if (endOfLines.length > 1) {
            endOfLines.reduce((previousIndex: number, currentIndex: number) => {
                splittedLines.push(splittedWords.slice(previousIndex, currentIndex).join(' '));
                return currentIndex
            })
        }

        return splittedLines;
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
}

