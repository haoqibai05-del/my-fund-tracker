// api/market.js
export default async function handler(req, res) {
    // 我们需要抓取的底层指数：纳指100, 标普500, 标普500等权重, 人民币汇率
    const symbols = ['^NDX', '^GSPC', '^SPXEW', 'CNY=X'];
    const result = {};

    try {
        // 并发请求 Yahoo 财经的开源 API（无跨域限制，且实时性极高）
        await Promise.all(symbols.map(async (symbol) => {
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`);
            const data = await response.json();
            
            const resultData = data.chart.result[0];
            const closes = resultData.indicators.quote[0].close;
            // 拿到今天最新价和昨天收盘价
            const currentPrice = closes[closes.length - 1];
            const prevClose = closes[closes.length - 2] || resultData.meta.chartPreviousClose;
            
            const changePercent = ((currentPrice - prevClose) / prevClose) * 100;

            result[symbol] = {
                price: currentPrice.toFixed(2),
                change: changePercent.toFixed(2)
            };
        }));

        res.status(200).json({
            updateTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
            data: result
        });
    } catch (error) {
        res.status(500).json({ error: '数据获取失败' });
    }
}