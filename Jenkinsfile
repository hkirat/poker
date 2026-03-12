pipeline {
agent any


stages {

    stage('Clone Repository') {
        steps {
            git 'https://github.com/pks2906/poker-devops.git'
        }
    }

    stage('Build Docker Images') {
        steps {
            sh 'docker build -t pks2906/poker-backend -f docker/backend.Dockerfile .'
            sh 'docker build -t pks2906/poker-websocket -f docker/websocket.Dockerfile .'
            sh 'docker build -t pks2906/poker-user-frontend -f docker/frontend.Dockerfile .'
            sh 'docker build -t pks2906/poker-admin-frontend -f docker/frontend.Dockerfile .'
        }
    }

    stage('Push Images to Docker Hub') {
        steps {
            sh 'docker login -u pks2906 -p $DOCKERHUB_PASSWORD'
            sh 'docker push pks2906/poker-backend'
            sh 'docker push pks2906/poker-websocket'
            sh 'docker push pks2906/poker-user-frontend'
            sh 'docker push pks2906/poker-admin-frontend'
        }
    }

    stage('Deploy to Kubernetes') {
        steps {
            sh 'kubectl apply -f k8s/'
        }
    }

}


}
