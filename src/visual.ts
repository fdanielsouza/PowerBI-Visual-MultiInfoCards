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
import { style } from "d3";

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
        this.svg.selectAll('.card').remove();
        this.svg.selectAll('.title').remove();

        let dataView: DataView = options.dataViews[0];
        let titleValues = dataView.categorical.categories[0].values;
        let infoValues = dataView.categorical.values;

        this.visualSettings = VisualSettings.parse<VisualSettings>(dataView);

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
        let cardHeight = this.visualSettings.cards.cardHeight;
        let cardWidth = this.visualSettings.cards.cardWidth;
        
        this.svg
            .attr('height', Visual.calculateTotalSVGHeight(titleValues.length, cardHeight, cardWidth, containerWidth))
            .attr('width', containerWidth)
            .style('overflow', 'scroll');

        let cards = this.svg
            .selectAll('.card')
            .data(titleValues)
            
        cards
            .enter()
            .append('rect')
            .classed('card', true)
            .attr('height', cardHeight)
            .attr('width', cardWidth)
            .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardHeight, cardWidth, containerWidth))
            .style('fill', this.visualSettings.cards.backgroundColor);


        let titles = this.svg
            .selectAll('.title')
            .data(titleValues)

        titles
            .enter()
            .append('text')
            .classed('title', true)
            .attr('y', titlesFontHeight)
            .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardHeight, cardWidth, containerWidth))
            .style('font-size', titlesFontSize)
            .style('font-family', this.visualSettings.cardsTitles.fontFamily)
            .style('fill', this.visualSettings.cardsTitles.fontColor)
            .text((title: string) => {
                return Visual.fitTextInsideCard(
                    title, 
                    this.visualSettings.cardsTitles.fontFamily, 
                    titlesFontSize, 
                    cardWidth
                )
            });



        
        // Each field of information values will be rendered over the cards
        infoValues.forEach((infoValue: powerbi.DataViewValueColumn, index: number) => {
            this.svg.selectAll('.info' + index).remove();
            /**
             *  Calculate height for each block of information texts, so it can control the minimum  
             *  spacing between blocks,also recording the totals in the DataViewValueColumn object 
             *  will let the card total height to be correctly calculated
             * 
             **/ 
            let infoLongestValue = infoValue.values.reduce((c: string, n: string) => c.length > n.length ? c : n);
            let infoLongestHeight = Visual.calculateMultiLineTextHeight(
                infoLongestValue.toString(), 
                this.visualSettings.cardsInformations.infoValuesFontFamily, 
                infoValuesFontSize, 
                cardWidth,
                infoValuesFontHeight
            );
            
            infoValue["infoTotalSpacing"] = d3.min([d3.max([infoNamesFontHeight + infoLongestHeight, this.visualSettings.cardsInformations.spaceBetweenInformations]), 600]);            
            infoValue["cumulativeTotalSpacing"] = infoValues.slice(0, index + 1)
                .map((i: powerbi.DataViewValueColumn) => i["infoTotalSpacing"])
                .reduce((c: number, n: number) => c + n);



            let infos = this.svg
                .selectAll('.info' + index)
                .data(infoValue.values)
                .enter()
            
            infos
                .append('text')
                .classed('info' + index, true)
                .attr('y', (titlesFontHeight * 2.5) + infoValue["cumulativeTotalSpacing"] - infoValue["infoTotalSpacing"])
                .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardHeight, cardWidth, containerWidth))
                .style('font-size', infoNamesFontSize)
                .style('font-family', this.visualSettings.cardsInformations.infoNamesFontFamily)
                .style('fill', this.visualSettings.cardsInformations.infoNamesFontColor)
                .text(
                    Visual.fitTextInsideCard(
                        infoValue.source.displayName, 
                        this.visualSettings.cardsInformations.infoNamesFontFamily, 
                        infoNamesFontSize, 
                        cardWidth
                    )
                );

            infos
                .append('text')
                .classed('info' + index, true)
                .attr('y', (titlesFontHeight * 2.5) + infoNamesFontHeight + infoValue["cumulativeTotalSpacing"] - infoValue["infoTotalSpacing"])
                .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardHeight, cardWidth, containerWidth))
                .style('font-size', infoValuesFontSize)
                .style('font-family', this.visualSettings.cardsInformations.infoValuesFontFamily)
                .style('fill', this.visualSettings.cardsInformations.infoValuesFontColor)
                .html((value: any) => {
                    return Visual.fitMultiLineLongText(
                        value.toString(), 
                        this.visualSettings.cardsInformations.infoValuesFontFamily, 
                        infoValuesFontSize, 
                        cardWidth,
                        infoValuesFontHeight
                    )
                });

                infos
                    .exit()
                    .remove();                   
        });
            

        cards
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


    public static calculateCardHeight(totalElementsHeight: number): number {
        return totalElementsHeight + 20
    }

    public static calculateTotalSVGHeight(dataLength: number, cardHeight: number, cardWidth: number, containerWidth: number): number {
        let totalHeight: number = Math.ceil(dataLength / Math.floor(containerWidth / cardWidth)) * cardHeight;

        return totalHeight;
    }

    public static positionCardInGrid(position: number, cardHeight: number, cardWidth: number, containerWidth: number): string {
        let maxPerRow: number = Math.floor(containerWidth / cardWidth);
        let x: number = (position - (maxPerRow * Math.floor(position / maxPerRow))) * cardWidth;
        let y: number = Math.floor(position / maxPerRow) * cardHeight;

        return 'translate('+ x +', '+ y +')';
    }

    public static fitTextInsideCard(text: string, fontFamily: string, fontSize: string, cardWidth: number): string {
        let textProperties: TextProperties = {
            text: text,
            fontFamily: fontFamily,
            fontSize: fontSize
        };

        return textMeasurementService.getTailoredTextOrDefault(textProperties, cardWidth);
    }

    public static fitMultiLineLongText(text: string, fontFamily: string, fontSize: string, cardWidth: number, fontHeight: number): string {
        let textProperties: TextProperties = {
            text: text,
            fontFamily: fontFamily,
            fontSize: fontSize
        };

        let textWidth: number = textMeasurementService.measureSvgTextWidth(textProperties);
        let textLength: number = text.length;
        let maxCharsPerLine: number = Math.floor(textLength * (cardWidth / textWidth)) - 1;
        let splittedText: string[] = text.match(new RegExp('.{1,' + maxCharsPerLine + '}', 'g'));
        let multiLineHtmlText: string = '<tspan>' + splittedText[0] + '</tspan>';
        
        splittedText.slice(1).forEach((line: string) => {
            multiLineHtmlText += '<tspan x = 0, dy=' + fontHeight + '>' + line + '</tspan>'
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
        let totalTextHeight: number = Math.ceil(textWidth / cardWidth) * fontHeight;

        return totalTextHeight;
    }
}

