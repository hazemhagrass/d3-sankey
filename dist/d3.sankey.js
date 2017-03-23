var sankeyCore = function () {
    var sankey = {},
        nodeWidth = 24,
        nodePadding = 8,
        size = [1, 1],
        nodes = [],
        links = [];

    sankey.nodeWidth = function (_) {
        if (!arguments.length) return nodeWidth;
        nodeWidth = +_;
        return sankey;
    };

    sankey.nodePadding = function (_) {
        if (!arguments.length) return nodePadding;
        nodePadding = +_;
        return sankey;
    };

    sankey.nodes = function (_) {
        if (!arguments.length) return nodes;
        nodes = _;
        return sankey;
    };

    sankey.links = function (_) {
        if (!arguments.length) return links;
        links = _;
        return sankey;
    };

    sankey.size = function (_) {
        if (!arguments.length) return size;
        size = _;
        return sankey;
    };

    sankey.layout = function (iterations) {
        computeNodeLinks();
        computeNodeValues();
        computeNodeBreadths();
        computeNodeDepths(iterations);
        computeLinkDepths();
        return sankey;
    };

    sankey.relayout = function () {
        computeLinkDepths();
        return sankey;
    };

    sankey.link = function () {
        var curvature = .5;

        function link(d) {
            var x0 = d.source.x + d.source.dx,
                x1 = d.target.x,
                xi = d3.interpolateNumber(x0, x1),
                x2 = xi(curvature),
                x3 = xi(1 - curvature),
                y0 = d.source.y + d.sy + d.dy / 2,
                y1 = d.target.y + d.ty + d.dy / 2;
            return "M" + x0 + "," + y0
                + "C" + x2 + "," + y0
                + " " + x3 + "," + y1
                + " " + x1 + "," + y1;
        }

        link.curvature = function (_) {
            if (!arguments.length) return curvature;
            curvature = +_;
            return link;
        };

        return link;
    };

    // Populate the sourceLinks and targetLinks for each node.
    // Also, if the source and target are not objects, assume they are indices.
    function computeNodeLinks() {
        nodes.forEach(function (node) {
            node.sourceLinks = [];
            node.targetLinks = [];
        });
        links.forEach(function (link) {
            var source = link.source,
                target = link.target;
            if (typeof source === "number") source = link.source = nodes[link.source];
            if (typeof target === "number") target = link.target = nodes[link.target];
            source.sourceLinks.push(link);
            target.targetLinks.push(link);
        });
    }

    // Compute the value (size) of each node by summing the associated links.
    function computeNodeValues() {
        nodes.forEach(function (node) {
            node.value = Math.max(
                d3.sum(node.sourceLinks, value),
                d3.sum(node.targetLinks, value)
            );
        });
    }

    // Iteratively assign the breadth (x-position) for each node.
    // Nodes are assigned the maximum breadth of incoming neighbors plus one;
    // nodes with no incoming links are assigned breadth zero, while
    // nodes with no outgoing links are assigned the maximum breadth.
    function computeNodeBreadths() {
        var remainingNodes = nodes,
            nextNodes,
            x = 0;

        while (remainingNodes.length) {
            nextNodes = [];
            remainingNodes.forEach(function (node) {
                node.x = x;
                node.dx = nodeWidth;
                node.sourceLinks.forEach(function (link) {
                    if (nextNodes.indexOf(link.target) < 0) {
                        nextNodes.push(link.target);
                    }
                });
            });
            remainingNodes = nextNodes;
            ++x;
        }

        //
        moveSinksRight(x);
        scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
    }

    function moveSourcesRight() {
        nodes.forEach(function (node) {
            if (!node.targetLinks.length) {
                node.x = d3.min(node.sourceLinks, function (d) {
                        return d.target.x;
                    }) - 1;
            }
        });
    }

    function moveSinksRight(x) {
        nodes.forEach(function (node) {
            if (!node.sourceLinks.length) {
                node.x = x - 1;
            }
        });
    }

    function scaleNodeBreadths(kx) {
        nodes.forEach(function (node) {
            node.x *= kx;
        });
    }

    function computeNodeDepths(iterations) {
        var nodesByBreadth = d3.nest()
            .key(function (d) {
                return d.x;
            })
            .sortKeys(d3.ascending)
            .entries(nodes)
            .map(function (d) {
                return d.values;
            });

        //
        initializeNodeDepth();
        resolveCollisions();
        for (var alpha = 1; iterations > 0; --iterations) {
            relaxRightToLeft(alpha *= .99);
            resolveCollisions();
            relaxLeftToRight(alpha);
            resolveCollisions();
        }

        function initializeNodeDepth() {
            var ky = d3.min(nodesByBreadth, function (nodes) {
                return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
            });

            nodesByBreadth.forEach(function (nodes) {
                nodes.forEach(function (node, i) {
                    node.y = i;
                    node.dy = node.value * ky;
                });
            });

            links.forEach(function (link) {
                link.dy = link.value * ky;
            });
        }

        function relaxLeftToRight(alpha) {
            nodesByBreadth.forEach(function (nodes, breadth) {
                nodes.forEach(function (node) {
                    if (node.targetLinks.length) {
                        var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
                        node.y += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedSource(link) {
                return center(link.source) * link.value;
            }
        }

        function relaxRightToLeft(alpha) {
            nodesByBreadth.slice().reverse().forEach(function (nodes) {
                nodes.forEach(function (node) {
                    if (node.sourceLinks.length) {
                        var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
                        node.y += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedTarget(link) {
                return center(link.target) * link.value;
            }
        }

        function resolveCollisions() {
            nodesByBreadth.forEach(function (nodes) {
                var node,
                    dy,
                    y0 = 0,
                    n = nodes.length,
                    i;

                // Push any overlapping nodes down.
                nodes.sort(ascendingDepth);
                for (i = 0; i < n; ++i) {
                    node = nodes[i];
                    dy = y0 - node.y;
                    if (dy > 0) node.y += dy;
                    y0 = node.y + node.dy + nodePadding;
                }

                // If the bottommost node goes outside the bounds, push it back up.
                dy = y0 - nodePadding - size[1];
                if (dy > 0) {
                    y0 = node.y -= dy;

                    // Push any overlapping nodes back up.
                    for (i = n - 2; i >= 0; --i) {
                        node = nodes[i];
                        dy = node.y + node.dy + nodePadding - y0;
                        if (dy > 0) node.y -= dy;
                        y0 = node.y;
                    }
                }
            });
        }

        function ascendingDepth(a, b) {
            return a.y - b.y;
        }
    }

    function computeLinkDepths() {
        nodes.forEach(function (node) {
            node.sourceLinks.sort(ascendingTargetDepth);
            node.targetLinks.sort(ascendingSourceDepth);
        });
        nodes.forEach(function (node) {
            var sy = 0, ty = 0;
            node.sourceLinks.forEach(function (link) {
                link.sy = sy;
                sy += link.dy;
            });
            node.targetLinks.forEach(function (link) {
                link.ty = ty;
                ty += link.dy;
            });
        });

        function ascendingSourceDepth(a, b) {
            return a.source.y - b.source.y;
        }

        function ascendingTargetDepth(a, b) {
            return a.target.y - b.target.y;
        }
    }

    function center(node) {
        return node.y + node.dy / 2;
    }

    function value(link) {
        return link.value;
    }

    return sankey;
};

d3.sankeyChart = function (data, options) {

    var self = this;

    self.nodeWidth = options.nodeWidth ? options.nodeWidth : 15;
    self.nodePadding = options.nodePadding ? options.nodePadding : 10;

    self.margin = options.margin;
    self.width = options.width;
    self.height = options.height;
    self.innerWidth = options.width - self.margin.left - self.margin.right;
    self.innerHeight = options.height - self.margin.top - self.margin.bottom;
    self.dynamicLinkColor = options.dynamicLinkColor ? options.dynamicLinkColor : false;
    self.staticLinkColor = options.staticLinkColor ? options.staticLinkColor : '#000';
    self.formatNumber = d3.format(',.0f');
    self.format = d => `${self.formatNumber(d)}`;
    self.color = d3.scale.category20();

    let canvas, svg, sankey, link, path, node = null;

    self.initContainers = function () {
        canvas = d3.select(options.chart + ' canvas')
            .attr('width', self.width)
            .attr('height', self.height)
            .style('position', 'absolute');

        svg = d3.select(options.chart + ' svg')
            .style('position', 'absolute')
            .attr('width', self.width)
            .attr('height', self.height)
            .append('g')
            .attr('transform', `translate(${self.margin.left}, ${self.margin.top})`);
    };
    self.initCore = function () {
        sankey = new sankeyCore()
            .nodeWidth(self.nodeWidth)
            .nodePadding(self.nodePadding)
            .size([self.innerWidth, self.innerHeight]);

        sankey
            .nodes(data.nodes)
            .links(data.links)
            .layout(32);
    };

    self.renderLinks = function () {
        path = sankey.link();
        link = svg.append('g').selectAll('.link')
            .data(data.links)
            .enter().append('path')
            .attr('class', 'link')
            .attr('d', path)
            .style('stroke-width', d => Math.max(1, d.dy))
            .style({
                fill: 'none',
                'stroke-opacity': 0.15
            })
            .style('stroke', function (d) {
                let color = self.staticLinkColor ? self.staticLinkColor : '#000';
                color = self.dynamicLinkColor ? self.color(d.source.name.replace(/ .*/, '')) : color;

                return color;
            })
            .sort((a, b) => b.dy - a.dy);

        link
            .on('mouseover', function () {
                d3.select(this)
                    .style('stroke-opacity', 0.25);
            })
            .on('mouseout', function () {
                d3.select(this)
                    .style('stroke-opacity', 0.15);
            });

        link.append('title')
            .text(d => `${d.source.name} → ${d.target.name}\n${self.format(d.value)}`);
    };

    self.renderNodes = function () {
        node = svg.append('g').selectAll('.node')
            .data(data.nodes)
            .enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`)
            .call(d3.behavior.drag()
                .origin(d => d)
                .on('dragstart', function () {
                    this.parentNode.appendChild(this);
                })
                .on('drag', dragmove));

        node.append('rect')
            .attr('height', d => d.dy)
            .attr('width', sankey.nodeWidth())
            .style('fill', d => {
                d.color = self.color(d.name.replace(/ .*/, ''));
                return d.color;
            })
            .style({
                stroke: 'none',
                cursor: 'move',
                'fill-opacity': 0.9,
                'shape-rendering': 'crispEdges'
            })
            .append('title')
            .text(d => `${d.name}\n${self.format(d.value)}`);

        node.append('text')
            .attr('x', -6)
            .attr('y', d => d.dy / 2)
            .attr('dy', '.35em')
            .attr('text-anchor', 'end')
            .attr('transform', null)
            .style({
                'pointer-events': 'none',
                'text-shadow': '0 1px 0 #fff'
            })
            .text(d => d.name)
            .filter(d => d.x < self.innerWidth / 2)
            .attr('x', 6 + sankey.nodeWidth())
            .attr('text-anchor', 'start');
    };

    self.renderTrafficInLinks = function () {
        const linkExtent = d3.extent(data.links, d => d.value);

        const frequencyScale = d3.scale.linear()
            .domain(linkExtent)
            .range([0.05, 1]);

        /* const particleSize = */
        d3.scale.linear()
            .domain(linkExtent)
            .range([1, 5]);

        data.links.forEach(currentLink => {
            currentLink.freq = frequencyScale(currentLink.value);
            currentLink.particleSize = 2;
            currentLink.particleColor = d3.scale.linear().domain([0, 1])
                .range([currentLink.source.color, currentLink.target.color]);
        });

        /* const t = */
        d3.timer(tick, 1000);
        let particles = [];

        function tick(elapsed /* , time */) {
            particles = particles.filter(d => d.current < d.path.getTotalLength());

            d3.selectAll('path.link')
                .each(
                    function (d) {
                        //        if (d.freq < 1) {
                        for (let x = 0; x < 2; x++) {
                            const offset = (Math.random() - 0.5) * (d.dy - 4);
                            if (Math.random() < d.freq) {
                                const length = this.getTotalLength();
                                particles.push({
                                    link: d,
                                    time: elapsed,
                                    offset,
                                    path: this,
                                    length,
                                    animateTime: length,
                                    speed: 0.5 + (Math.random())
                                });
                            }
                        }
                    });

            particleEdgeCanvasPath(elapsed);
        }

        function particleEdgeCanvasPath(elapsed) {
            if(d3.select('canvas').node()){
                const context = d3.select('canvas').node().getContext('2d');

                context.clearRect(0, 0, 1000, 1000);

                context.fillStyle = 'gray';
                context.lineWidth = '1px';
                for (const x in particles) {
                    if ({}.hasOwnProperty.call(particles, x)) {
                        const currentTime = elapsed - particles[x].time;
                        //        let currentPercent = currentTime / 1000 * particles[x].path.getTotalLength();
                        particles[x].current = currentTime * 0.15 * particles[x].speed;
                        const currentPos = particles[x].path.getPointAtLength(particles[x].current);
                        context.beginPath();
                        context.fillStyle = particles[x].link.particleColor(0);
                        context.arc(
                            currentPos.x,
                            currentPos.y + particles[x].offset,
                            particles[x].link.particleSize,
                            0,
                            2 * Math.PI
                        );
                        context.fill();
                    }
                }
            }
        }
    };

    self.initContainers();
    self.initCore();
    self.renderLinks();

    self.renderNodes();
    self.renderTrafficInLinks();

    function dragmove(d) {
        d3.select(this)
            .attr('transform', `translate(${d.x}, ${(d.y = Math.max(0, Math.min(self.innerHeight - d.dy, d3.event.y)))})`);
        sankey.relayout();
        link.attr('d', path);
    }


}
