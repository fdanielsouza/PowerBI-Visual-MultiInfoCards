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
type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;

export class Visual implements IVisual {
    private visualSettings: VisualSettings;
    private host: IVisualHost;
    private svg: Selection<SVGElement>;
    private g: Selection<SVGElement>;
    private showAllDataPoints: boolean;
 

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
        this.visualSettings = VisualSettings.parse<VisualSettings>(dataView);
        
        let containerHeight = options.viewport.height;
        let containerWidth = options.viewport.width;
        let cardHeight = 320;
        let cardWidth = 200;

        let titleValues = dataView.categorical.categories[0].values;
        let infoValues = dataView.categorical.values[0].values;

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
            .attr('y', 10)
            .attr('transform', (_, index: number) => Visual.positionCardInGrid(index, cardHeight, cardWidth, containerWidth))
            .style('fill', 'white')
            .text((title: string) => title);




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
}

interface TextProperties {
    text?: string;
    fontFamily: string;
    fontSize: string;
    fontWeight?: string;
    fontStyle?: string;
    fontVariant?: string;
    whiteSpace?: string;
}

