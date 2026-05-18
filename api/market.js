// api/market.js
export default async function handler(req, res) {
    // 1. 用于画 K 线图的指数和汇率
    const chartSymbols = ['^IXIC', '^NDX', '^GSPC', '^SPXEW', 'CNH=X'];
    
    // 2. 【核心】所有基金底层重仓股的代码池 (一网打尽，绝不超载)
    // 包含了英伟达、微软、苹果、Meta、谷歌、亚马逊、特斯拉、博通、超威半导体等
    // 包含了这三只基金最新季报中的核心重仓股
    const stockSymbols = ['NFLX', 'NVDA', 'AAPL', 'MSFT', 'AVGO', 'TSM', 'LITE', 'GOOGL', 'GLW', 'VIAV', 'WDC', 'MU', 'AEIS', 'TER'];
    
    const result = { indices: {}, stocks: {} };

    try {
        // 任务A：获取 K线图 基础数据
        await Promise.all(chartSymbols.map(async (symbol) => {
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`);
            const data = await response.json();
            const chart = data.chart.result[0];

            const timestamps = chart.timestamp || [];
            const quote = chart.indicators.quote[0];
            const currentPrice = quote.close[quote.close.length - 1];
            const prevClose = chart.meta.chartPreviousClose;
            const changePercent = ((currentPrice - prevClose) / prevClose) * 100;

            const klineData = timestamps.map((t, index) => {
                if (quote.close[index] === null) return null;
                const date = new Date(t * 1000);
                const timeStr = date.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' });
                return [timeStr, quote.open[index], quote.close[index], quote.low[index], quote.high[index]];
            }).filter(item => item !== null);

            result.indices[symbol] = { price: currentPrice.toFixed(2), change: changePercent.toFixed(2), trend: klineData };
        }));

        // 任务B：获取所有成分个股的实时涨跌幅（仅需1次批量请求！）
        if (stockSymbols.length > 0) {
            const quoteRes = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${stockSymbols.join(',')}`);
            const quoteData = await quoteRes.json();
            quoteData.quoteResponse.result.forEach(quote => {
                result.stocks[quote.symbol] = {
                    price: quote.regularMarketPrice,
                    change: quote.regularMarketChangePercent
                };
            });
        }

        // 依然保留 60 秒边缘缓存护盾
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
        res.status(200).json({
            updateTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
            data: result
        });
    } catch (error) {
        res.status(500).json({ error: '数据获取失败' });
    }
}