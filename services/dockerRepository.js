'use strict'
const Clair = require('clair-client')
const Repository = require('../collections/repository')
const Image = require('../collections/image')
const Vulnerability = require('../collections/vulnerability')
const conf = require('../collections/config')
const io = require('./socketService')
const common = require('./common')
const { debug, info, warn, error } = require('./logger')
const config = require('./config')
const { dbException, clairException, paramsException } = require('../class/exceptions')

/**
 * @param: data: {
 *   
 * }
 */
const testRepository = (data) => {
  return new Promise((resolve, reject) => {
    const dcrApiCheck = {
      url: `${data.isHttps ? 'https' : 'http'}://${data.repository}${data.port ? `:${data.port}` : ''}/v2`,
      username: data.isAuth && data.username !== '' ? data.username : null,
      passwd: data.isAuth && data.passwd !== '' ? data.passwd : null
    }
    // debug(`request:${JSON.stringify(dcrApiCheck)}`)
    common.get(dcrApiCheck).then(function (data) {
      info('testRepository: complete')
      resolve(true)
    }).catch(function (err) {
      warn('testRepository: faild')
      resolve(false)
    })
  })
}

/**
 * @param: data: {
 *   name: '测试124',
 *   repository: '192.168.3.124',
 *   port: 5000,
 *   username: 'abc',
 *   passwd: 'abc123',
 *   isAuth: false,
 *   isHttps: false
 * }
 * 
 * @return: {
 *   name: '测试124',
 *   repository: '192.168.3.124',
 *   port: 5000,
 *   username: 'abc',
 *   passwd: 'abc123',
 *   isAuth: false,
 *   isHttps: false,
 *   images: [
 *     'ubuntu',
 *     'redis'
 *   ]
 * }
 */
const getImageByRepository = (data) => {
  return new Promise((resolve, reject) => {
    const dcrApi_catalog = {
      url: `${data.isHttps ? 'https' : 'http'}://${data.repository}${data.port ? `:${data.port}` : ''}/v2/_catalog`,
      username: data.isAuth && data.username !== '' ? data.usernmae : null,
      passwd: data.isAuth && data.passwd !== '' ? data.passwd : null
    }
    // debug(`request: ${JSON.stringify(dcrApi_catalog)}`)
    common
      .get(dcrApi_catalog)
      .then(res => {
        info(`getImageByRepository: complete`)
        // debug(JSON.stringify(res))
        data.images = res.repositories
        resolve(data)
      })
      .catch(function (err) {
        warn('getImageByRepository: faild')
        reject(err)
      })
  })
}

/**
 * @param: data: {
 *   name: '测试124',
 *   repository: '192.168.3.124',
 *   port: 5000,
 *   username: 'abc',
 *   passwd: 'abc123',
 *   isAuth: false,
 *   isHttps: false,
 *   images: [
 *     'ubuntu',
 *     'redis'
 *   ]
 * }
 * 
 * @return: {
 *   data: {
 *     name: '测试124',
 *     repository: '192.168.3.124',
 *     port: 5000,
 *     username: 'abc',
 *     passwd: 'abc123',
 *     isAuth: false,
 *     isHttps: false,
 *     images: [{
 *       image: 'ubuntu',
 *       tags: [ latest ]
 *     }]
 *   },
 *   errors: {
 *     image: 'deepdefense-scanner',
 *     err: 'null'
 *   }
 * }
 */
const getTagByImage = (data) => {
  let errors = []
  let results = []
  return new Promise(async (resolve, reject) => {
    if (data.images && data.images.length > 0) {
      for (let i in data.images) {
        let dcrApiTagList = {
          url: `${data.isHttps ? 'https' : 'http'}://${data.repository}:${data.port}/v2/${data.images[i]}/tags/list`,
          username: data.isAuth && data.username !== '' ? data.username : null,
          passwd: data.isAuth && data.passwd !== '' ? data.passwd : null
        }
        debug(`request: ${JSON.stringify(dcrApiTagList)}`)
        try {
          let tags = (await common.get(dcrApiTagList)).tags
          // debug(`tags of ${data.images[i]}: ${JSON.stringify(tags)}`)
          if (tags !== null) {
            results.push({
              image: data.images[i],
              tags: tags
            })
          }
        } catch (err) {
          warn(`tags of ${data.images[i]} err: ${err}`)
          errors.push({
            image: data.images[i],
            err: err
          })
        }
      }
      data.images = results
      info('getTagByImage: complete')
      resolve({ data, errors })
    } else {
      data.images = results
      info('getTagByImage: complete')
      resolve({ data, errors })
    }
  })
}

/**
 * @param: data: {
 *   name: '测试124',
 *   repository: '192.168.3.124',
 *   port: 5000,
 *   username: 'abc',
 *   passwd: 'abc123',
 *   isAuth: false,
 *   isHttps: false,
 *   image: 'ubuntu',
 *   tags: 'latest'
 * }
 * 
 * @return: {
 *   result: {
 *     repository: '192.168.3.124:5000',
 *     image: 'ubuntu',
 *     tag: '1604',
 *     namespace: 'ubuntu:16.04',
 *     high: 10,
 *     medium: 24,
 *     low: 100,
 *     negligible: 0,
 *     unknown: 1,
 *     score: 24.001
 *   },
 *   vulnerabilities: [{
 *       ...
 *     }, {...}
 *   ]
 * }
 */
const clairAnalyze = (data) => {
  let vulnerabilities = new Array()
  let result = new Object()
  return new Promise((resolve, reject) => {
    let clairOption = {
      clairAddress: common.getScannerUrl(),
      dockerInsecure: !data.isHttps
    }
    if (data.isAuth && data.username !== '' && data.passwd !== '') {
      clairOption.dockerUsername = data.username
      clairOption.dockerPassword = data.passwd
    }
    const clair = new Clair(clairOption)
    const image = `${data.isHttps ? 'https' : 'http'}://${data.repository}${data.port ? `:${data.port}` : ''}/${data.image}:${data.tag}`
    // debug(JSON.stringify(image))
    clair
      .analyze({ image })
      .then(async (analyzeResult) => {
        result = {
          repository: `${data.repository}${data.port ? `:${data.port}` : ''}`,
          image: data.image,
          tag: data.tag,
          namespace: analyzeResult.vulnerabilities[0].NamespaceName ? analyzeResult.vulnerabilities[0].NamespaceName : null
        }
        let [high, medium, low, negligible, unknown] = [0, 0, 0, 0, 0]
        let levels = {
          high,
          medium,
          low,
          negligible,
          unknown
        }
        for (const vul1 of analyzeResult.vulnerabilities) {
          for (const vul2 of vul1.Vulnerabilities) {
            levels[vul2.Severity.toLowerCase()]++
            vulnerabilities.push(
              Object.assign(vul2, {
                VulName: vul1.Name,
                VersionFormat: vul1.VersionFormat,
                Version: vul1.Version
              })
            )
          }
        }
        result = Object.assign(result, levels)
        result.score = await calScore(result)
        // debug(`result: ${JSON.stringify(result)}`)
        // debug(`vulnerabilities: ${JSON.stringify(vulnerabilities)}`)
        resolve({ vulnerabilities, result })
      })
      .catch(err => {
        reject(new clairException(err))
      })
  })
}

/**
 * @params data: {
 *   data: {
 *     name: '测试124',
 *     repository: '192.168.3.124',
 *     port: 5000,
 *     username: 'abc',
 *     passwd: 'abc123',
 *     isAuth: false,
 *     isHttps: false,
 *     images: [{
 *       image: 'ubuntu',
 *       tags: [ latest ]
 *     }]
 *   },
 *   errors: {
 *     image: 'deepdefense-scanner',
 *     err: 'null'
 *   }
 * }
 * 
 * @return: {
 *   results: [{
 *     result: {
 *       repository: 
 *     },
 *     vulnerability: [{
 *       
 *     }, {...}, ...
 *     ]
 *   }, {...}, ...],
 *   errors: [{
 *     image: '192.168.3.124:5000/redis:latest',
 *     err: '...'
 *   }, {...}, ...]
 * }
 */
const analyzeImage = (data) => {
  return new Promise(async (resolve, reject) => {
    data = data.data
    let [results, errors] = [[], []]
    for (let image of data.images) {
      for (let tag of image.tags) {
        try {
          let result = await clairAnalyze({
            repository: data.repository,
            port: data.port,
            username: data.username,
            passwd: data.passwd,
            isHttps: data.isHttps,
            isAuth: data.isAuth,
            image: image.image,
            tag: tag
          })
          results.push(result)
        } catch (err) {
          errors.push({
            image: `${data.repository}${data.port ? `:${data.port}` : ``}/${image.image}:${tag}`,
            err: err.stack
          })
        }
      }
    }
    info(`reposiroty ${data.repository}: analyze complete`)
    resolve({ results, errors })
  })
}

/**
 * @param: data: {
 *   data: {
 *     repository: '192.168.3.124',
 *     port: 5000,
 *     isAuth: false,
 *     isHttps: false,
 *     username: 'abc',
 *     passwd: 'abc123',
 *     images: [{
 *       image: 'ubuntu',
 *       tags: ['16.04', ...]
 *     }, {...}, ...]
 *   }, errors: [{
 *     image: 'redis',
 *     err: 'null'
 *     }, {...}, ...]
 * }
 * 
 * @return: [
 *   {}, {...}, ...
 * ]
 */
const formatResponse = (data) => {
  data = data.data
  let results = []
  data.images.forEach(image => {
    image.tags.forEach(tag => {
      results.push({
        repository: `${data.repository}${data.port ? `:${data.port}` : ''}`,
        image: image.image,
        tag: tag,
        namespace: '',
        high: -1,
        medium: -1,
        low: -1,
        negligible: -1,
        unknown: -1,
        score: -1
      })
    })
  })
  return results
}

/**
 * @param: data: {
 *   data: {
 *     repository: '192.168.3.124',
 *     port: 5000,...
 *   }
 * }
 */
const removeImages = (data) => {
  let errors = data.errors
  data = data.data
  return new Promise((resolve, reject) => {
    Image
      .deleteMany({
        repository: `${data.repository}${data.port ? `:${data.port}` : ''}`,
      })
      .then(res => {
        if (res.ok == 1) {
          info(`remove images of ${data.repository}${data.port ? `:${data.port}` : ''}: complete, count: ${res.deletedCount}`)
          resolve({ data, errors })
        } else {
          throw new dbException(`something wrong happend`)
        }
      })
      .catch(err => {
        reject(new dbException(err))
      })
  })
}

/**
 * @param: data: {
 *   results: [{
 *     result: {
 *       repository: 
 *     },
 *     vulnerability: [{
 *       
 *     }, {...}, ...
 *     ]
 *   }, {...}, ...],
 *   errors: [{
 *     image: '192.168.3.124:5000/redis:latest',
 *     err: '...'
 *   }, {...}, ...]
 * }
 * 
 * @return: {
 *   results: [{
 *     result: {
 *       repository: 
 *     },
 *     vulnerability: [{
 *       
 *     }, {...}, ...
 *     ]
 *   }, {...}, ...],
 *   errors: [{
 *     image: '192.168.3.124:5000/redis:latest',
 *     err: '...'
 *   }, {...}, ...]
 * }
 */
const removeVulnerabilities = (data) => {
  return new Promise((resolve, reject) => {
    data.results.forEach(item => {
      let { result, vulnerabilities } = item
      Vulnerability
        .deleteMany({
          repository: result.repository,
          image: result.image,
          tag: result.tag
        })
        .then(res => {
          if (res.ok == 1) {
            info(`remove vulnerabilities of ${result.repository}/${result.image}:${result.tag}: complete, count: ${res.deletedCount}`)
            resolve(data)
          } else {
            throw new Error(`something wrong happen`)
          }
        })
        .catch(err => {
          reject(new dbException(err))
        })
    })
  })
}

/**
 * @param: data: [{
 *   repository: '192.168.3.124:5000',
 *   image: 'ubuntu',
 *   tag: '16.04',
 *   namespace: 'ubuntu:16.04',
 *   high: 12,
 *   medium: 24,
 *   low: 100,
 *   negligible: 0,
 *   unknown: 1,
 *   score: 24.001
 * }, {...}, ...]
 */
const saveImages = (data) => {
  return new Promise((resolve, reject) => {
    data.forEach(image => {
      Image
        .findOneAndUpdate(
          {
            repository: image.repository,
            image: image.image,
            tag: image.tag
          }, {
            $set: image
          }, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          })
        .then(doc => {
          resolve(data)
        })
        .catch(err => {
          reject(err)
        })
    })
  })
}

/**
 * @param: data: {
 *   results: [{
 *     result: {
 *       repository: 
 *     },
 *     vulnerability: [{
 *       
 *     }, {...}, ...
 *     ]
 *   }, {...}, ...],
 *   errors: [{
 *     image: '192.168.3.124:5000/redis:latest',
 *     err: '...'
 *   }, {...}, ...]
 * }
 */
const saveVulnerabilities = (data) => {
  return new Promise((resolve, reject) => {
    data.results.forEach(item => {
      let { result, vulnerabilities } = item
      vulnerabilities.forEach(vul => {
        Vulnerability
          .create({
            repository: result.repository,
            image: result.image,
            tag: result.tag,
            cveId: vul.Name,
            description: vul.Description,
            link: vul.Link,
            level: vul.Severity,
            type: vul.VulName,
            versionFormat: vul.VersionFormat,
            version: vul.Version
          })
          .then(doc => {
            debug(`${result.repository}/${result.image}:${result.tag}: ${vul.Name} save complete`)
          })
          .catch(err => {
            warn(`${result.repositories}/${result.image}:${result.tag}: ${vul.Name} save fail`)
          })
      })
    })
  })
}

/**
 * @param: data: {
 *   high: 10,
 *   medium: 24,
 *   low: 100,
 *   neriable: 0,
 *   unknow: 3
 * }
 * 
 * @return: 24.001<number>
 */
const calScore = (data) => {
  let [sum, score] = [0, 0]
  return new Promise(function (resolve, reject) {
    conf.findOne({ key: 'SCORE' })
      .then((doc) => {
        if (doc) {
          const levels = Object.keys(doc.config)
          for (const level of levels) {
            score += data[level] * (doc.config[level] / doc.config['low'])
            sum += data[level]
          }
          info('calScore: complete')
          resolve(score / 100)
        } else {
          throw new dbException('No such config info')
        }
      })
      .catch((err) => {
        warn('calScore: fail')
        reject(err)
      })
  })
}


const freshRepository = () => {
  Repository
    .find({})
    .then(docs => {
      docs.forEach(doc => {
        getImageByRepository(doc)
          .then(getTagByImage)
          .then(removeImages)
          .then(data => {
            return new Promise((resolve, reject) => {
              saveImages(formatResponse(data))
                .then(() => {
                  resolve(data)
                })
                .catch(err => {
                  reject(err)
                })
            })
          })
          .then(analyzeImage)
          .then(removeVulnerabilities)
          .then(saveVulnerabilities)
      })
    }, (err) => {
      throw new dbException(err)
    })
    .catch(err => {
      warn(err)
    })
}

const freshImage = () => {
  Image
    .find({ score: -1, isEnable: true })
    .then(docs => {
      docs.forEach(doc => {
        Repository
          .findOne({
            repository: doc.repository.split(':')[0]
          })
          .then(repoDoc => {
            return new Promise((resolve, reject) => {
              resolve({
                repository: repoDoc.repository,
                port: repoDoc.port,
                username: repoDoc.username,
                passwd: repoDoc.passwd,
                isHttps: repoDoc.isHttps,
                isAuth: repoDoc.isAuth,
                image: doc.image,
                tag: doc.tag
              })
            })
          })
          .then(clairAnalyze)
          .then(analyzeResult => {
            saveImages([analyzeResult.result])
              .catch(err => { warn(err.stack) })
            removeVulnerabilities({ data: analyzeResult })
              .then(saveVulnerabilities)
              .catch(err => {
                warn(err.stack)
              })

          })
          .catch(err => {
            if (err.code == 5001) {
              doc.isEnable = false
              Image
                .findOneAndUpdate({
                  repository: doc.repository,
                  image: doc.image,
                  tag: doc.tag
                }, {
                    $set: doc
                  }, {
                    upsert: true, new: true
                  })
                .then(res => {
                  warn(`cannot analyze now`)
                })
                .catch(err => {
                  warn(err.stack)
                })
            } else {
              warn(err)
            }
          })
      })
    })
}

module.exports = {
  testRepository,
  getImageByRepository,
  getTagByImage,
  clairAnalyze,
  analyzeImage,
  calScore,
  formatResponse,
  removeImages,
  removeVulnerabilities,
  saveImages,
  saveVulnerabilities,
  freshRepository,
  freshImage
}
