require('dotenv').config();
const axios = require('axios');
const https = require('https');
const qs = require('qs');

// you can get api token here https://dash.cloudflare.com/profile/api-tokens
const apiKey = process.env.API_KEY; //this is api token
const email = process.env.EMAIL;

async function getZones() {
  try {
    const response = await axios.get('https://api.cloudflare.com/client/v4/zones', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Zone ID: ', response.data.result[0].id);
    // response first zoneId
    return response.data.result[0].id;
  } catch (error) {
    console.error('Error when get zones:', error.response ? error.response.data : error.message);
  }
}

async function getDNSRecords(zoneId) {
  try {
    const response = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('current ip', response.data.result[0].content);
    console.log('record ID: ', response.data.result[0].id);
    // response first recordId
    return { id: response.data.result[0].id, ip: response.data.result[0].content };
  } catch (error) {
    console.error('Error when get DNS records:', error.response ? error.response.data : error.message);
  }
}

async function updateDNS(zoneId, recordId, newIP = '192.168.1.1') {
  const dnsRecord = {
    type: 'A',
    name: process.env.DOMAIN,
    content: newIP,
    ttl: 120,
    proxied: false
  };
  try {
    const response = await axios.put(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
      dnsRecord,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Update done:', response.data.result.name);
    console.log(response.data.result.content);
    console.log('success', response.data.success);
  } catch (error) {
    console.error('Error when update DNS:', error.response ? error.response.data : error.message);
  }
}

async function getCurrentIP(Cookie) {
  const agent = new https.Agent({
    rejectUnauthorized: false
  });
  const config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: 'https://192.168.1.1/cgi-bin/get_deviceinfo.cgi?val=0&pvc=0&entry=0',
    headers: {
      'Cookie': Cookie
    },
    httpsAgent: agent
  };

  try {
    const response = await axios.request(config);
    console.log("new public IP: ", response.data.wan_ip_addr);
    return response.data.wan_ip_addr;
  } catch (error) {
    console.error('Lỗi khi lấy thông tin IP:', error);
  }
}

async function login() {
  const agent = new https.Agent({
    rejectUnauthorized: false
  });
  const data = qs.stringify({
    'StatusActionFlag': '-1',
    'Username': process.env.ROUTER_USER,
    'Password': process.env.ROUTER_PWD
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://192.168.1.1/cgi-bin/login.asp',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': 'anythingyouwant'
    },
    httpsAgent: agent,
    data: data
  };

  try {
    const response = await axios.request(config);
    console.log('Cookie: ', response.headers['set-cookie'][0].split(';')[0]);
    return response.headers['set-cookie'][0].split(';')[0];
  } catch (error) {
    console.error('Error when login:', error);
  }
}

async function getInfoAndUpdate(newIP) {
  const zoneId = await getZones();
  const dnsRecords = await getDNSRecords(zoneId);
  if (dnsRecords.ip !== newIP) {
    updateDNS(zoneId, dnsRecords.id, newIP);
  } else {
    console.log('IP not change');
  }
}

let lastIPAddress = '';
let lastCookie = '';
async function handleUpdateDNSRecord() {
  let Cookie = '';
  let newIP = await getCurrentIP(lastCookie);
  if (newIP) {
    // check local ipaddress
    if (newIP != lastIPAddress) {
      getInfoAndUpdate(newIP);
    }
  } else {
    Cookie = await login();
    lastCookie = Cookie;
    newIP = await getCurrentIP(Cookie);
    getInfoAndUpdate(newIP);
  }
  lastIPAddress = newIP;
}

handleUpdateDNSRecord();
setInterval(handleUpdateDNSRecord, 1000 * 10);
