// 设置优选地址api接口
let addressesapi = [
    //可参考内容格式 自行搭建。
    'https://vless-4ca.pages.dev/sub?host=test.vless.workers.dev&uuid=7c7227f2-78cd-4d1f-83d4-5f440a452df6&edgetunnel=cmliu&proxyip=true',
    'https://moistr.freenods.sbs/free?host=test.vless.workers.dev&uuid=66ba1abe-967f-485a-9234-9dc4b563448e&path=/12njls'
];

let SUBUpdateTime = 6;
let total = 99;//PB
let timestamp = 4102329600000;//2099-12-31

function decodeAndExtract(text) {
    // 使用 `atob()` 函数进行 base64 解码
    const decodedText = atob(text);

    // 按行拆分文本
    const lines = decodedText.split('\n');

    const results = [];

    for (const line of lines) {

        // 对每一行进行 decodeURIComponent 解码
        const decodedLine = decodeURIComponent(line);
        const temp = []

        // 匹配 @ 和第一个 ? 之间的內容
        const match1 = decodedLine.match(/@(.*?)\?/);
        if (match1) {
            temp.push(match1[1]);
        }

        // 匹配 # 之后的内容
        const match2 = decodedLine.match(/#(.*)$/);
        if (match2) {
            temp.push(match2[1].replace(" 已启用临时域名中转服务，请尽快绑定自定义域！",""));
        }

        results.push(temp.join("#"))

    }

    // 按行组合输出，并去除空行
    const output = results.map(line => `${line}`).join('\n');
    return output;
}

function parseURL(url) {

    if(url.includes("]:")){
        url = url.replace("]:","]#");
    }else{
        url = url.replace(":","#");
    }

    const split = url.split('#');


    return {
        hostname: split[0],
        port: split[1],
        fragment: split[2],
    };
}

async function getAddressesapi(ip, base64) {
    let addresses = [];
    try {
        const response = await fetch(ip);

        if (!response.ok) {
            console.error('获取地址时出错:', response.status, response.statusText);
        }

        let text = await response.text();

        // 需要base64解码
        if(!!base64){
            text = decodeAndExtract(text);
        }

        let lines;
        if (text.includes('\r\n')){
            lines = text.split('\r\n');
        } else {
            lines = text.split('\n');
        }

        addresses = lines.map(line => {
            const match = line.length > 0 && line.includes(':') && line.includes('#');
            return match ? line : null;
        }).filter(Boolean);

    } catch (error) {
        console.error('获取地址时出错:', error);
    }

    return addresses;
}


let protocol;
export default {
    async fetch (request, env) {

        const url = new URL(request.url);

        let ip = url.searchParams.get('ip');
        let base64 = url.searchParams.get('base64');
        let host = url.searchParams.get('host');
        let sni = url.searchParams.get('sni');
        let uuid = url.searchParams.get('uuid');
        let path = url.searchParams.get('path');
        let prefix = url.searchParams.get('prefix');
        let addresses = [];

        let UD = Math.floor(((timestamp - Date.now())/timestamp * 99 * 1099511627776 * 1024)/2);
        total = total * 1099511627776 * 1024;
        let expire= Math.floor(timestamp / 1000) ;

        if (!url.pathname.includes("/sub")) {
            const responseText = `

			路径必须包含 "/sub"
			
			${url.origin}/sub?ip=[ip address]&host=[your host]&uuid=[your uuid]&path=[your path]
			
				`;

            return new Response(responseText, {
                status: 400,
                headers: { 'content-type': 'text/plain; charset=utf-8' },
            });
        }

        if (!ip || !host || !uuid || !path) {
            const responseText = `
			缺少必填参数：ip, host , uuid, path
			
			
			${url.origin}/sub?ip=[ip address]&host=[your host]&uuid=[your uuid]&path=[your path]
			
			
				`;

            return new Response(responseText, {
                status: 400,
                headers: { 'content-type': 'text/plain; charset=utf-8' },
            });
        }

        addresses = await getAddressesapi(ip, base64);

        // 使用Set对象去重
        const uniqueAddresses = [...new Set(addresses)];

        let index = 0;

        const responseBody = uniqueAddresses.map(address => {
            index += 1;

            const url = parseURL(address) || {};
            const {hostname, port, fragment} = url;

            if(!host){
                return `${prefix + fragment + index} = vmess, ${hostname}, ${port}, username=${uuid}, ws-path=${path}, sni=${sni}, skip-cert-verify=true, ws=true, vmess-aead=true, tls=true`;
            }

            if(!sni){
                return `${prefix + fragment + index} = vmess, ${hostname}, ${port}, username=${uuid}, ws-path=${path}, ws-headers=Host:"${host}", skip-cert-verify=true, ws=true, vmess-aead=true, tls=true`;
            }

            return  `${prefix + fragment + index} = vmess, ${hostname}, ${port}, username=${uuid}, ws-path=${path}, ws-headers=Host:"${host}", sni=${sni}, skip-cert-verify=true, ws=true, vmess-aead=true, tls=true`;

        }).join('\n');


        return new Response(responseBody, {
            headers: {
                //"Content-Disposition": `attachment; filename*=utf-8''${encodeURIComponent(FileName)}; filename=${FileName}`,
                "content-type": "text/plain; charset=utf-8",
                "Profile-Update-Interval": `${SUBUpdateTime}`,
                "Subscription-Userinfo": `upload=${UD}; download=${UD}; total=${total}; expire=${expire}`,
            },
        });


    }
};
